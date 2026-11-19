'use strict';
const menu=document.querySelector('.menu'),nav=document.querySelector('nav');
menu?.addEventListener('click',()=>{const open=nav.classList.toggle('open');menu.setAttribute('aria-expanded',String(open));});
nav?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');menu.setAttribute('aria-expanded','false');}));
document.querySelector('#year').textContent=new Date().getFullYear();
document.querySelectorAll('[data-service]').forEach(b=>b.addEventListener('click',()=>{document.querySelector('#contact').scrollIntoView({behavior:'smooth'});document.querySelector('[name=message]').value='مرحبًا، أريد الاستفسار عن: '+b.dataset.service;}));
document.querySelector('#contactForm').addEventListener('submit',e=>{e.preventDefault();document.querySelector('#formNote').textContent='نسخة تجريبية: لم يتم إرسال الرسالة أو تخزينها. سيتم تفعيل الإرسال الآمن بعد إعداد الخادم.';});
