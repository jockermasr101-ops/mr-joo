'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const crypto = require('node:crypto');

initializeApp();
const db = getFirestore();
const REGION = 'europe-west1';
const MAX_ITEMS = 20;
const MAX_AMOUNT = 5_000_000; // EGP; adjust to the business's approved limit.

function requireAuth(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'سجّل الدخول أولاً.');
  return request.auth.uid;
}
function cleanText(value, min, max, field) {
  if (typeof value !== 'string') throw new HttpsError('invalid-argument', `${field} غير صالح.`);
  const v = value.trim();
  if (v.length < min || v.length > max) throw new HttpsError('invalid-argument', `${field} يجب أن يكون بين ${min} و${max} حرفًا.`);
  return v;
}
async function getProfile(uid) {
  const snap = await db.doc(`users/${uid}`).get();
  if (!snap.exists) throw new HttpsError('permission-denied', 'الحساب غير مهيأ.');
  return snap.data();
}
async function requireStaff(uid, allowed = ['owner', 'admin', 'staff', 'orders', 'accountant', 'support']) {
  const p = await getProfile(uid);
  if (!allowed.includes(p.role)) throw new HttpsError('permission-denied', 'ليس لديك صلاحية لهذه العملية.');
  return p;
}
function safeId(v, name) {
  if (typeof v !== 'string' || !/^[A-Za-z0-9_-]{8,80}$/.test(v)) throw new HttpsError('invalid-argument', `${name} غير صالح.`);
  return v;
}

// Prices and product names are always loaded from Firestore, never trusted from the browser.
exports.createOrder = onCall({ region: REGION, enforceAppCheck: true }, async (request) => {
  const uid = requireAuth(request);
  const items = request.data?.items;
  if (!Array.isArray(items) || items.length < 1 || items.length > MAX_ITEMS) throw new HttpsError('invalid-argument', 'قائمة المنتجات غير صالحة.');
  const normalized = [];
  const seen = new Set();
  for (const item of items) {
    const productId = safeId(item?.productId, 'معرّف المنتج');
    const quantity = Number(item?.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10 || seen.has(productId)) throw new HttpsError('invalid-argument', 'الكمية أو المنتجات غير صالحة.');
    seen.add(productId);
    const productSnap = await db.doc(`products/${productId}`).get();
    if (!productSnap.exists || productSnap.data().active !== true) throw new HttpsError('failed-precondition', 'أحد المنتجات لم يعد متاحًا.');
    const p = productSnap.data();
    const price = Number(p.price);
    if (!Number.isSafeInteger(price) || price < 0 || price > MAX_AMOUNT) throw new HttpsError('failed-precondition', 'سعر أحد المنتجات غير مضبوط.');
    normalized.push({ productId, title: cleanText(p.title, 1, 120, 'اسم المنتج'), unitPrice: price, quantity, lineTotal: price * quantity });
  }
  const total = normalized.reduce((sum, x) => sum + x.lineTotal, 0);
  if (!Number.isSafeInteger(total) || total <= 0 || total > MAX_AMOUNT) throw new HttpsError('failed-precondition', 'إجمالي الطلب غير صالح.');
  const orderRef = db.collection('orders').doc();
  await db.runTransaction(async (tx) => {
    tx.create(orderRef, {
      uid, items: normalized, subtotal: total, total, currency: 'EGP',
      status: 'awaiting_payment', paymentStatus: 'unpaid',
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
    });
  });
  return { orderId: orderRef.id, total, currency: 'EGP' };
});

// Receipt upload must happen to the private Storage path first; this callable only records its path.
exports.submitTransfer = onCall({ region: REGION, enforceAppCheck: true }, async (request) => {
  const uid = requireAuth(request);
  const orderId = safeId(request.data?.orderId, 'رقم الطلب');
  const receiptPath = cleanText(request.data?.receiptPath, 10, 300, 'مسار الإيصال');
  const reference = cleanText(request.data?.reference || '', 3, 80, 'مرجع التحويل');
  if (!receiptPath.startsWith(`receipts/${uid}/${orderId}/`)) throw new HttpsError('permission-denied', 'مسار الإيصال غير مسموح.');
  const orderRef = db.doc(`orders/${orderId}`);
  const transferRef = db.collection('transfers').doc();
  await db.runTransaction(async (tx) => {
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists || orderSnap.data().uid !== uid) throw new HttpsError('not-found', 'الطلب غير موجود.');
    const order = orderSnap.data();
    if (order.paymentStatus === 'paid' || !['awaiting_payment', 'payment_review'].includes(order.status)) throw new HttpsError('failed-precondition', 'لا يمكن إرسال إيصال لهذا الطلب الآن.');
    const duplicate = await tx.get(db.collection('transfers').where('reference', '==', reference).limit(1));
    if (!duplicate.empty) throw new HttpsError('already-exists', 'مرجع التحويل مستخدم بالفعل.');
    tx.create(transferRef, { uid, orderId, amount: order.total, currency: order.currency, reference, receiptPath, status: 'pending', createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    tx.update(orderRef, { status: 'payment_review', updatedAt: FieldValue.serverTimestamp() });
  });
  return { transferId: transferRef.id, status: 'pending' };
});

// Only owner/admin/accountant may approve or reject. Approval writes ledger exactly once.
exports.reviewTransfer = onCall({ region: REGION, enforceAppCheck: true }, async (request) => {
  const uid = requireAuth(request);
  await requireStaff(uid, ['owner', 'admin', 'accountant']);
  const transferId = safeId(request.data?.transferId, 'رقم التحويل');
  const decision = request.data?.decision;
  const note = typeof request.data?.note === 'string' ? request.data.note.trim().slice(0, 500) : '';
  if (!['approve', 'reject'].includes(decision)) throw new HttpsError('invalid-argument', 'قرار المراجعة غير صالح.');
  const transferRef = db.doc(`transfers/${transferId}`);
  const result = await db.runTransaction(async (tx) => {
    const tSnap = await tx.get(transferRef);
    if (!tSnap.exists) throw new HttpsError('not-found', 'التحويل غير موجود.');
    const t = tSnap.data();
    if (t.status !== 'pending') throw new HttpsError('failed-precondition', 'تمت مراجعة التحويل من قبل.');
    const orderRef = db.doc(`orders/${t.orderId}`);
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists || orderSnap.data().uid !== t.uid) throw new HttpsError('data-loss', 'بيانات الطلب غير متطابقة.');
    const order = orderSnap.data();
    if (decision === 'reject') {
      tx.update(transferRef, { status: 'rejected', reviewedBy: uid, reviewNote: note, updatedAt: FieldValue.serverTimestamp() });
      tx.update(orderRef, { status: 'awaiting_payment', paymentStatus: 'unpaid', updatedAt: FieldValue.serverTimestamp() });
      return { status: 'rejected' };
    }
    if (order.paymentStatus === 'paid' || Number(t.amount) !== Number(order.total)) throw new HttpsError('failed-precondition', 'المبلغ أو حالة الطلب لا يسمحان بالتأكيد.');
    const ledgerRef = db.collection('ledger').doc(`transfer_${transferId}`);
    tx.create(ledgerRef, { uid: t.uid, orderId: t.orderId, transferId, type: 'payment', amount: t.amount, currency: t.currency, createdBy: uid, createdAt: FieldValue.serverTimestamp() });
    tx.update(transferRef, { status: 'approved', reviewedBy: uid, reviewNote: note, ledgerId: ledgerRef.id, updatedAt: FieldValue.serverTimestamp() });
    tx.update(orderRef, { status: 'in_progress', paymentStatus: 'paid', paidAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    return { status: 'approved', ledgerId: ledgerRef.id };
  });
  return result;
});

// Server-mediated support message creation supports staff replies while preserving append-only history.
exports.sendSupportMessage = onCall({ region: REGION, enforceAppCheck: true }, async (request) => {
  const uid = requireAuth(request);
  const conversationUid = cleanText(request.data?.conversationUid, 1, 128, 'معرّف المحادثة');
  const text = cleanText(request.data?.text, 1, 1000, 'الرسالة');
  const profile = await getProfile(uid);
  const isCustomer = uid === conversationUid && profile.role === 'client';
  const isSupport = ['owner', 'admin', 'staff', 'support'].includes(profile.role);
  if (!isCustomer && !isSupport) throw new HttpsError('permission-denied', 'لا يمكنك إرسال رسالة لهذه المحادثة.');
  const shellRef = db.doc(`support/${conversationUid}`);
  const messageRef = shellRef.collection('messages').doc();
  await db.runTransaction(async (tx) => {
    const shell = await tx.get(shellRef);
    if (!shell.exists && !isCustomer) throw new HttpsError('not-found', 'المحادثة غير موجودة.');
    if (!shell.exists) {
      if (!isCustomer) throw new HttpsError('not-found', 'المحادثة غير موجودة.');
      tx.set(shellRef, { uid: conversationUid, status: 'open', createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), lastMessageAt: FieldValue.serverTimestamp(), lastSenderUid: uid });
    } else {
      if (shell.data().status === 'closed' && isCustomer) throw new HttpsError('failed-precondition', 'المحادثة مغلقة.');
      tx.update(shellRef, { lastMessageAt: FieldValue.serverTimestamp(), lastSenderUid: uid, updatedAt: FieldValue.serverTimestamp() });
    }
    tx.create(messageRef, { senderUid: uid, senderRole: isCustomer ? 'client' : profile.role, text, createdAt: FieldValue.serverTimestamp() });
  });
  return { messageId: messageRef.id };
});

// Utility: create opaque request tokens server-side if a future workflow needs them.
exports.healthCheck = onCall({ region: REGION, enforceAppCheck: true }, async (request) => {
  requireAuth(request);
  return { ok: true, requestToken: crypto.randomUUID() };
});
