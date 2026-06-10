const app = {
    data: {
        customers: []
    },
    state: {
        activeScreen: 'home-screen',
        currentCustomerId: null,
        calcType: null,
        calcValue: '0'
    },

    init() {
        this.loadLocalData();
        this.setupEventListeners();
        this.renderHome();
        this.requestNotificationPermission();
        this.checkReminders();
    },

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active', 'hidden'));
        document.querySelectorAll('.screen').forEach(s => {
            if(s.id === screenId) s.classList.add('active');
            else s.classList.add('hidden');
        });
        this.state.activeScreen = screenId;
        if(screenId === 'home-screen') this.renderHome();
    },

    loadLocalData() {
        const stored = localStorage.getItem('accountingAppData');
        if (stored) {
            try { this.data = JSON.parse(stored); } 
            catch (e) { console.error("خطأ", e); }
        }
    },

    saveData() {
        localStorage.setItem('accountingAppData', JSON.stringify(this.data));
    },

    exportData() {
        try {
            const dataStr = JSON.stringify(this.data, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
            
            document.body.appendChild(a);
            a.click();
            
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 200);

            document.getElementById('sync-indicator').className = 'indicator green';
            document.getElementById('sync-text').innerText = 'تم التنزيل بنجاح';
            setTimeout(() => { document.getElementById('sync-text').innerText = 'محفوظ بالهاتف'; }, 3000);
            
        } catch (error) {
            alert("حدث خطأ أثناء محاولة التنزيل.");
        }
    },

    importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                if (importedData && Array.isArray(importedData.customers)) {
                    this.data = importedData;
                    this.saveData();
                    this.renderHome();
                    alert("✅ تمت استعادة البيانات بنجاح!");
                } else {
                    alert("❌ ملف البيانات غير صالح.");
                }
            } catch (error) {
                alert("❌ حدث خطأ أثناء قراءة الملف.");
            }
        };
        reader.readAsText(file);
        event.target.value = ''; 
    },

    addCustomer() {
        const name = document.getElementById('add-name').value.trim();
        // دمج رقم الهاتف مع مفتاح تركيا 
        const phone = "+90" + document.getElementById('add-phone').value.trim();
        const email = document.getElementById('add-email').value;
        const address = document.getElementById('add-address').value;

        if (!name) return alert("يرجى إدخال اسم العميل");

        const newCustomer = {
            id: Date.now().toString(),
            name, phone, email, address,
            transactions: [],
            reminderDate: null
        };

        this.data.customers.push(newCustomer);
        this.saveData();
        
        document.getElementById('add-name').value = '';
        document.getElementById('add-phone').value = '';
        document.getElementById('add-email').value = '';
        document.getElementById('add-address').value = '';
        
        this.showScreen('home-screen');
    },

    async fetchContact() {
        if ('contacts' in navigator && 'ContactsManager' in window) {
            try {
                const contacts = await navigator.contacts.select(['name', 'tel'], {multiple: false});
                if (contacts.length > 0) {
                    document.getElementById('add-name').value = contacts[0].name[0] || '';
                    if(contacts[0].tel && contacts[0].tel.length > 0) {
                        let fetchedPhone = contacts[0].tel[0].replace(/[\s-]/g, '');
                        // إزالة مفتاح تركيا لتجنب تكراره في المربع الرمادي
                        if(fetchedPhone.startsWith('+90')) fetchedPhone = fetchedPhone.substring(3);
                        else if(fetchedPhone.startsWith('0090')) fetchedPhone = fetchedPhone.substring(4);
                        
                        document.getElementById('add-phone').value = fetchedPhone;
                    }
                }
            } catch (ex) {
                alert("تم إلغاء العملية أو لا توجد صلاحيات قراءة جهات الاتصال.");
            }
        } else {
            alert("يرجى التأكد من دعم متصفحك أو التطبيق لميزة جلب الأسماء.");
        }
    },

    renderHome(searchTerm = "") {
        const listEl = document.getElementById('customers-list');
        listEl.innerHTML = '';
        
        let totalGave = 0;
        let totalTook = 0;

        const filtered = this.data.customers.filter(c => c.name.includes(searchTerm));
        // إجبار الأرقام على التنسيق الإنجليزي 'en-US'
        document.getElementById('customers-count').innerText = Number(this.data.customers.length).toLocaleString('en-US');

        filtered.forEach(customer => {
            let cGave = 0, cTook = 0;
            customer.transactions.forEach(t => {
                if (t.type === 'gave') cGave += t.amount;
                if (t.type === 'took') cTook += t.amount;
            });
            totalGave += cGave;
            totalTook += cTook;

            const balance = cGave - cTook;
            let balanceText = `TRY ${Math.abs(balance).toLocaleString('en-US')}`;
            let balanceClass = balance > 0 ? 'balance-gave' : (balance < 0 ? 'balance-took' : '');
            let label = balance > 0 ? 'أعطيت' : (balance < 0 ? 'أخذت' : 'مُصفَر');

            const card = document.createElement('div');
            card.className = 'customer-card';
            card.onclick = () => this.openProfile(customer.id);
            card.innerHTML = `
                <div class="customer-info">
                    <h3>${customer.name}</h3>
                    <p>${customer.transactions.length > 0 ? 'مضت ' + Number(this.getDaysAgo(customer.transactions[customer.transactions.length-1].date)).toLocaleString('en-US') + ' أيام' : 'لا توجد عمليات'}</p>
                </div>
                <div class="customer-balance en-font">
                    <div class="${balanceClass}">${balanceText}</div>
                    <small style="color:gray; font-size:10px;">${label}</small>
                </div>
            `;
            listEl.appendChild(card);
        });

        document.getElementById('total-gave').innerText = totalGave.toLocaleString('en-US');
        document.getElementById('total-took').innerText = totalTook.toLocaleString('en-US');
    },

    getDaysAgo(dateString) {
        const diff = Date.now() - new Date(dateString).getTime();
        return Math.floor(diff / (1000 * 3600 * 24));
    },

    openProfile(id) {
        this.state.currentCustomerId = id;
        const customer = this.data.customers.find(c => c.id === id);
        if(!customer) return;

        document.getElementById('profile-name').innerText = customer.name;
        
        let cGave = 0, cTook = 0;
        const tList = document.getElementById('transactions-list');
        tList.innerHTML = '';

        [...customer.transactions].reverse().forEach(t => {
            if (t.type === 'gave') cGave += t.amount;
            if (t.type === 'took') cTook += t.amount;
            
            const div = document.createElement('div');
            div.className = `transaction-item t-${t.type}`;
            div.innerHTML = `
                <div>
                    <strong>${t.type === 'gave' ? 'أعطيت' : 'أخذت'}</strong>
                    <div class="t-date en-font">${t.date}</div>
                    ${t.note ? `<div style="font-size:12px; margin-top:5px;">${t.note}</div>` : ''}
                </div>
                <strong dir="ltr" class="en-font">TRY ${Number(t.amount).toLocaleString('en-US')}</strong>
            `;
            tList.appendChild(div);
        });

        const balance = cGave - cTook;
        const balEl = document.getElementById('profile-total-balance');
        const statEl = document.getElementById('profile-balance-status');
        
        balEl.innerText = `TRY ${Math.abs(balance).toLocaleString('en-US')}`;
        if (balance > 0) {
            balEl.style.color = 'var(--red-main)';
            statEl.innerText = 'لك عليه';
        } else if (balance < 0) {
            balEl.style.color = 'var(--green-main)';
            statEl.innerText = 'له عليك';
        } else {
            balEl.style.color = 'var(--text-main)';
            statEl.innerText = 'الحساب مصفر';
        }

        this.showScreen('customer-profile-screen');
    },

    sendWhatsAppReport() {
        const customer = this.data.customers.find(c => c.id === this.state.currentCustomerId);
        if(!customer) return;

        let cGave = 0, cTook = 0;
        customer.transactions.forEach(t => {
            if (t.type === 'gave') cGave += t.amount;
            if (t.type === 'took') cTook += t.amount;
        });
        
        const balance = cGave - cTook;
        let statusTxt = balance > 0 ? 'لنا عليكم' : (balance < 0 ? 'لكم علينا' : 'الحساب مصفر');
        let absBalance = Math.abs(balance).toLocaleString('en-US');

        let message = `مرحباً ${customer.name}،\n\n`;
        message += `📄 *كشف حساب مختصر*\n`;
        message += `الرصيد الحالي: *${absBalance} TRY* (${statusTxt})\n\n`;
        
        if (customer.transactions.length > 0) {
            message += `*آخر العمليات:*\n`;
            [...customer.transactions].reverse().slice(0, 5).forEach(t => {
                let tType = t.type === 'gave' ? 'أعطيناك' : 'أخذنا منكم';
                let formattedAmount = Number(t.amount).toLocaleString('en-US');
                message += `- ${t.date} | ${tType}: ${formattedAmount} TRY ${t.note ? '('+t.note+')' : ''}\n`;
            });
        } else {
            message += `لا توجد عمليات مسجلة حتى الآن.\n`;
        }

        let phone = customer.phone.replace(/[^\d+]/g, '');
        const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    },

    openCalculator(type) {
        this.state.calcType = type;
        this.state.calcValue = '0';
        this.updateCalcDisplay();
        
        const confirmBtn = document.getElementById('btn-confirm-transaction');
        
        // تغيير ألوان الآلة الحاسبة وزر التأكيد حسب العملية
        if(type === 'gave') {
            document.getElementById('calc-title').innerText = 'أعطيت';
            document.getElementById('calc-title').style.color = 'var(--red-main)';
            confirmBtn.className = 'btn-confirm-calc gave';
        } else {
            document.getElementById('calc-title').innerText = 'أخذت';
            document.getElementById('calc-title').style.color = 'var(--green-main)';
            confirmBtn.className = 'btn-confirm-calc took';
        }
        
        document.getElementById('calc-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('calc-note').value = '';
        
        this.showScreen('calculator-screen');
    },

    calcInput(val) {
        if (val === 'AC') {
            this.state.calcValue = '0';
        } else if (val === 'DEL') {
            this.state.calcValue = this.state.calcValue.slice(0, -1) || '0';
        } else if (val === '=') {
            try {
                this.state.calcValue = String(new Function('return ' + this.state.calcValue.replace(/÷/g, '/').replace(/×/g, '*'))());
            } catch (e) {
                this.state.calcValue = 'Error';
            }
        } else {
            if (this.state.calcValue === '0' || this.state.calcValue === 'Error') {
                this.state.calcValue = val;
            } else {
                this.state.calcValue += val;
            }
        }
        this.updateCalcDisplay();
    },

    updateCalcDisplay() {
        let displayVal = this.state.calcValue;
        document.getElementById('calc-display').innerText = displayVal;
    },

    saveTransaction() {
        if(/[+\-*/]/.test(this.state.calcValue)) {
            this.calcInput('=');
        }
        
        const amount = parseFloat(this.state.calcValue);
        if (isNaN(amount) || amount <= 0) return alert('يرجى إدخال مبلغ صحيح');

        const customer = this.data.customers.find(c => c.id === this.state.currentCustomerId);
        if(!customer) return;

        customer.transactions.push({
            id: Date.now().toString(),
            type: this.state.calcType,
            amount: amount,
            date: document.getElementById('calc-date').value,
            note: document.getElementById('calc-note').value
        });

        this.saveData();
        this.openProfile(this.state.currentCustomerId);
    },

    async requestNotificationPermission() {
        if ("Notification" in window) {
            if (Notification.permission !== "granted" && Notification.permission !== "denied") {
                await Notification.requestPermission();
            }
        }
    },

    setReminder() {
        const customer = this.data.customers.find(c => c.id === this.state.currentCustomerId);
        const date = prompt("أدخل تاريخ التنبيه بصيغة (YYYY-MM-DD):", customer.reminderDate || new Date().toISOString().split('T')[0]);
        if(date) {
            customer.reminderDate = date;
            this.saveData();
            alert("تم حفظ التنبيه بنجاح");
        }
    },

    checkReminders() {
        const today = new Date().toISOString().split('T')[0];
        this.data.customers.forEach(customer => {
            if (customer.reminderDate && customer.reminderDate <= today) {
                const msg = `تذكير: لديك حساب مستحق مع العميل ${customer.name}`;
                setTimeout(() => alert(msg), 1000);
                
                if ("Notification" in window && Notification.permission === "granted") {
                    new Notification("تنبيه دين", { body: msg });
                }
                customer.reminderDate = null;
            }
        });
        this.saveData();
    },

    setupEventListeners() {
        document.getElementById('btn-export').addEventListener('click', () => this.exportData());
        
        const fileImportBtn = document.getElementById('file-import');
        document.getElementById('btn-import').addEventListener('click', () => fileImportBtn.click());
        fileImportBtn.addEventListener('change', (e) => this.importData(e));

        document.getElementById('fab-add-customer').addEventListener('click', () => this.showScreen('add-customer-screen'));
        document.getElementById('btn-save-customer').addEventListener('click', () => this.addCustomer());
        
        document.getElementById('btn-fetch-contact').addEventListener('click', (e) => {
            e.preventDefault();
            this.fetchContact();
        });

        document.getElementById('btn-confirm-transaction').addEventListener('click', () => this.saveTransaction());
        document.getElementById('btn-set-reminder').addEventListener('click', () => this.setReminder());
        document.getElementById('btn-whatsapp').addEventListener('click', () => this.sendWhatsAppReport());
        
        document.getElementById('search-input').addEventListener('input', (e) => {
            this.renderHome(e.target.value);
        });
    }
};

window.onload = () => app.init();
