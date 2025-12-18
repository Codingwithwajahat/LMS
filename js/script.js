const CONFIG = {
    usersKey: 'LMS_USERS',
    loansKey: 'LMS_LOANS',
    sessionKey: 'LMS_SESSION'
};

const DB = {
    get: key => JSON.parse(localStorage.getItem(key)) || [],
    set: (key, val) => localStorage.setItem(key, JSON.stringify(val)),
    getSession: () => JSON.parse(localStorage.getItem(CONFIG.sessionKey)),
    setSession: val => localStorage.setItem(CONFIG.sessionKey, JSON.stringify(val)),
    removeSession: () => localStorage.removeItem(CONFIG.sessionKey)
};

const formatCurrency = amount => `${Number(amount).toLocaleString()} PKR`;

document.addEventListener("DOMContentLoaded", () => {
    const currentUser = DB.getSession();
    const path = window.location.pathname.split('/').pop();
    const publicPages = ['index.html', 'register.html', 'forgot_password.html'];

    if (!currentUser && !publicPages.includes(path)) {
        window.location.href = 'index.html';
        return;
    }

    if (currentUser) {
        const nameDisplay = document.getElementById('userNameDisplay');
        if (nameDisplay) nameDisplay.textContent = currentUser.name;
    }

    if (currentUser?.email) {
        if (document.getElementById('statTotal')) loadUserStats(currentUser.email);
        if (document.getElementById('loansTable')) loadUserLoans(currentUser.email);
        if (document.getElementById('emiTable')) loadUserEMI(currentUser.email);
    }

    if (document.getElementById('adminLoanTable')) loadAdminLoans();

    document.querySelectorAll('.sidebar a').forEach(link => {
        if (link.getAttribute('href') === path) link.classList.add('active');
    });
});

function loadUserStats(email) {
    const loans = DB.get(CONFIG.loansKey).filter(l => l.userEmail === email);
    const active = loans.filter(l => l.status === 'Approved');
    const emiTotal = active.reduce((s, l) => s + Math.round(l.amount / l.months), 0);

    document.getElementById('statTotal').textContent = loans.length;
    document.getElementById('statActive').textContent = active.length;
    document.getElementById('statRejected').textContent = loans.filter(l => l.status === 'Rejected').length;
    document.getElementById('statEMI').textContent = formatCurrency(emiTotal);

    const recent = document.getElementById('recentActivityTable');
    if (!recent) return;

    recent.innerHTML = loans.length
        ? loans.slice(-3).reverse().map(l => `
            <tr>
                <td>${l.date}</td>
                <td>${l.type} Loan</td>
                <td>${Number(l.amount).toLocaleString()}</td>
                <td><span class="badge ${getStatusBadge(l.status)}">${l.status}</span></td>
            </tr>
        `).join('')
        : `<tr><td colspan="4" class="text-center p-3 text-muted">No recent activity.</td></tr>`;
}

function handleRegister(e) {
    e.preventDefault();
    const name = regName.value.trim();
    const email = regEmail.value.trim();
    const cnic = regCNIC.value.trim();
    const password = regPass.value;

    const users = DB.get(CONFIG.usersKey);

    if (users.some(u => u.email === email)) return alert("Email already exists!");
    if (users.some(u => u.cnic === cnic)) return alert("CNIC already exists!");

    users.push({ name, email, cnic, password, role: 'user' });
    DB.set(CONFIG.usersKey, users);

    alert("Registration Successful! Please Login.");
    window.location.href = 'index.html';
}

function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (email === 'admin@lms.com' && password === 'admin123') {
        DB.setSession({ name: 'Administrator', email, role: 'admin' });
        return window.location.href = 'admin_dashboard.html';
    }

    const user = DB.get(CONFIG.usersKey).find(u => u.email === email && u.password === password);
    if (!user) return alert("Invalid Credentials");

    DB.setSession(user);
    window.location.href = 'user_dashboard.html';
}

function handleLogout() {
    DB.removeSession();
    window.location.href = 'index.html';
}

function togglePass() {
    const input = document.getElementById('password') || document.getElementById('regPass');
    if (input) input.type = input.type === 'password' ? 'text' : 'password';
}

function calculateEMI() {
    const amount = Number(document.getElementById('amount').value);
    const months = Number(document.getElementById('months').value);

    if (!amount || !months) return;

    const r = 0.15 / 12;
    const emi = (amount * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
    document.getElementById('emiResult').textContent = formatCurrency(Math.round(emi));
}

function applyLoan(e) {
    e.preventDefault();
    const user = DB.getSession();

    const loan = {
        id: `LN${Date.now().toString().slice(-4)}`,
        userEmail: user.email,
        userName: user.name,
        amount: Number(amount.value),
        months: Number(months.value),
        type: loanType.value,
        status: 'Pending',
        date: new Date().toLocaleDateString()
    };

    const loans = DB.get(CONFIG.loansKey);
    loans.push(loan);
    DB.set(CONFIG.loansKey, loans);

    alert("Application Submitted!");
    window.location.href = 'user_loans.html';
}

function loadUserLoans(email) {
    const tbody = document.querySelector('#loansTable tbody');
    const loans = DB.get(CONFIG.loansKey).filter(l => l.userEmail === email);

    tbody.innerHTML = loans.length
        ? loans.map(l => `
            <tr>
                <td><strong>${l.id}</strong><br><small>${l.type}</small></td>
                <td>${Number(l.amount).toLocaleString()}</td>
                <td>${l.months} Mon</td>
                <td>${l.date}</td>
                <td><span class="badge ${getStatusBadge(l.status)}">${l.status}</span></td>
            </tr>
        `).join('')
        : `<tr><td colspan="5" class="text-center p-3">No Loans Found</td></tr>`;
}

function loadUserEMI(email) {
    const tbody = document.getElementById('emiTable');
    const loans = DB.get(CONFIG.loansKey).filter(l => l.userEmail === email && l.status === 'Approved');

    if (!loans.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center p-3">No Approved Loans.</td></tr>`;
        return;
    }

    const allLoans = DB.get(CONFIG.loansKey);
    let updated = false;
    loans.forEach(l => {
        const fullLoan = allLoans.find(x => x.id === l.id);
        if (fullLoan && (!fullLoan.payments || fullLoan.payments.length !== fullLoan.months)) {
            fullLoan.payments = Array.from({ length: fullLoan.months }, () => ({ paid: false, paidDate: null }));
            updated = true;
        }
    });
    if (updated) DB.set(CONFIG.loansKey, allLoans);

    let html = '';
    loans.forEach(l => {
        let date = new Date();
        const emi = Math.round(l.amount / l.months);

        html += `
            <tr class="table-light fw-bold">
                <td colspan="5" class="text-primary">Loan ID: ${l.id} - Total: ${formatCurrency(l.amount)}</td>
            </tr>
        `;

        for (let i = 1; i <= l.months; i++) {
            date.setMonth(date.getMonth() + 1);
            const installment = l.payments && l.payments[i - 1];
            const isPaid = installment?.paid;
            const statusBadge = isPaid ? `<span class="badge bg-success">Paid</span>` : `<span class="badge bg-secondary">Scheduled</span>`;
            const actionCell = isPaid ? `<td class="text-center">—</td>` : `<td class="text-center"><button class="btn btn-sm btn-success" onclick="payEMI('${l.id}', ${i - 1})">Pay Now</button></td>`;

            html += `
                <tr>
                    <td>${i}</td>
                    <td>${date.toDateString()}</td>
                    <td>${emi.toLocaleString()}</td>
                    <td>${statusBadge}</td>
                    ${actionCell}
                </tr>
            `;
        }
    });

    tbody.innerHTML = html;
}

function loadAdminLoans() {
    const tbody = document.getElementById('adminLoanTable');
    const loans = DB.get(CONFIG.loansKey);

    tbody.innerHTML = loans.map(l => `
        <tr>
            <td>${l.id}</td>
            <td>${l.userEmail}<br><small>${l.userName}</small></td>
            <td>${Number(l.amount).toLocaleString()}</td>
            <td><span class="badge ${getStatusBadge(l.status)}">${l.status}</span></td>
            <td>
                ${l.status === 'Pending'
            ? `<button class="btn btn-sm btn-primary" onclick="updateStatus('${l.id}','Approved')">Approve</button>
                       <button class="btn btn-sm btn-danger" onclick="updateStatus('${l.id}','Rejected')">Reject</button>`
            : '-'}
            </td>
        </tr>
    `).join('');
}

function updateStatus(id, status) {
    const loans = DB.get(CONFIG.loansKey);
    const loan = loans.find(l => l.id === id);
    if (!loan) return;

    loan.status = status;
    if (status === 'Approved' && (!loan.payments || loan.payments.length !== loan.months)) {
        loan.payments = Array.from({ length: loan.months }, () => ({ paid: false, paidDate: null }));
    }
    DB.set(CONFIG.loansKey, loans);
    loadAdminLoans();
}

function payEMI(loanId, index) {
    const confirmPay = confirm("Confirm payment for this installment?");
    if (!confirmPay) return;
    const loans = DB.get(CONFIG.loansKey);
    const loan = loans.find(l => l.id === loanId);
    if (!loan || !loan.payments || !loan.payments[index]) return alert("Installment not found.");
    if (loan.payments[index].paid) return alert("Already paid.");

    loan.payments[index].paid = true;
    loan.payments[index].paidDate = new Date().toISOString();

    DB.set(CONFIG.loansKey, loans);
    const currentUser = DB.getSession();
    if (currentUser?.email) loadUserEMI(currentUser.email);

    alert("Payment successful!");
}

function getStatusBadge(status) {
    return status === 'Approved' ? 'bg-success' :
        status === 'Rejected' ? 'bg-danger' : 'bg-warning';
}

function sendResetCode() {
    step1.classList.add('hidden');
    step2.classList.remove('hidden');
}

function verifyOTP() {
    step2.classList.add('hidden');
    step3.classList.remove('hidden');
}

function resetFinal() {
    alert("Password Reset Successfully!");
    window.location.href = 'index.html';
}
