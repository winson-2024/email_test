// 全局变量
let emailAccounts = []; // 所有邮箱账户
let currentAccount = null; // 当前选中的邮箱账户
let emailCounter = 1; // 邮箱计数器
let refreshIntervals = {}; // 每个邮箱的刷新定时器
let serviceStatus = {}; // 服务状态
let availableDomains = []; // 可用域名列表

// DOM 元素引用
const elements = {};

// 初始化应用
document.addEventListener('DOMContentLoaded', function() {
    initializeElements();
    bindEvents();
    loadStoredData();
    checkServiceStatus();
    updateUI();
    console.log('真实邮件服务系统初始化完成');
});

// 初始化DOM元素引用
function initializeElements() {
    elements.createEmailBtn = document.getElementById('createEmailBtn');
    elements.refreshAllBtn = document.getElementById('refreshAllBtn');
    elements.emailAccountsList = document.getElementById('emailAccountsList');
    elements.currentEmailAddress = document.getElementById('currentEmailAddress');
    elements.copyEmailBtn = document.getElementById('copyEmailBtn');
    elements.refreshEmailBtn = document.getElementById('refreshEmailBtn');
    elements.deleteEmailBtn = document.getElementById('deleteEmailBtn');
    elements.emailsList = document.getElementById('emailsList');
    elements.verificationPanel = document.getElementById('verificationPanel');
    elements.verificationResult = document.getElementById('verificationResult');
    elements.closeVerificationBtn = document.getElementById('closeVerificationBtn');
    elements.emailModal = document.getElementById('emailModal');
    elements.closeModalBtn = document.getElementById('closeModalBtn');
    elements.notification = document.getElementById('notification');
    elements.notificationText = document.getElementById('notificationText');
}

// 绑定事件监听器
function bindEvents() {
    // 防止重复绑定事件
    if (elements.createEmailBtn) {
        elements.createEmailBtn.removeEventListener('click', handleCreateEmail);
        elements.createEmailBtn.addEventListener('click', handleCreateEmail);
    }
    
    if (elements.refreshAllBtn) {
        elements.refreshAllBtn.removeEventListener('click', handleRefreshAll);
        elements.refreshAllBtn.addEventListener('click', handleRefreshAll);
    }
    
    if (elements.copyEmailBtn) {
        elements.copyEmailBtn.removeEventListener('click', handleCopyEmail);
        elements.copyEmailBtn.addEventListener('click', handleCopyEmail);
    }
    
    if (elements.refreshEmailBtn) {
        elements.refreshEmailBtn.removeEventListener('click', handleRefreshEmail);
        elements.refreshEmailBtn.addEventListener('click', handleRefreshEmail);
    }
    
    if (elements.deleteEmailBtn) {
        elements.deleteEmailBtn.removeEventListener('click', handleDeleteEmail);
        elements.deleteEmailBtn.addEventListener('click', handleDeleteEmail);
    }
    
    if (elements.closeVerificationBtn) {
        elements.closeVerificationBtn.removeEventListener('click', hideVerificationPanel);
        elements.closeVerificationBtn.addEventListener('click', hideVerificationPanel);
    }
    
    if (elements.closeModalBtn) {
        elements.closeModalBtn.removeEventListener('click', hideEmailModal);
        elements.closeModalBtn.addEventListener('click', hideEmailModal);
    }
    
    // 模态框背景点击关闭
    if (elements.emailModal) {
        elements.emailModal.removeEventListener('click', handleModalBackgroundClick);
        elements.emailModal.addEventListener('click', handleModalBackgroundClick);
    }
    
    // 键盘事件
    document.removeEventListener('keydown', handleKeyboardShortcuts);
    document.addEventListener('keydown', handleKeyboardShortcuts);
}

// 检查服务状态
async function checkServiceStatus() {
    try {
        showNotification('正在检查邮件服务状态...', 'info');
        
        const response = await fetch('/api/check-services', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            serviceStatus = data.results;
            
            // 统计服务状态
            const activeServices = Object.values(serviceStatus).filter(s => s.isActive);
            const totalServices = Object.keys(serviceStatus).length;
            
            showNotification(`服务状态检查完成: ${activeServices.length}/${totalServices} 个服务可用`, 'success');
            
            // 更新可用域名列表
            await updateAvailableDomains();
            
            // 更新UI显示服务状态
            updateServiceStatusDisplay();
            
            console.log('服务状态:', serviceStatus);
        } else {
            throw new Error(data.message || '检查服务状态失败');
        }
    } catch (error) {
        console.error('检查服务状态失败:', error);
        showNotification('检查服务状态失败: ' + error.message, 'error');
    }
}

// 更新可用域名列表
async function updateAvailableDomains() {
    try {
        const response = await fetch('/api/domains');
        const data = await response.json();
        
        if (data.success) {
            availableDomains = data.domains;
            console.log(`可用域名数量: ${availableDomains.length}`);
        }
    } catch (error) {
        console.error('获取域名列表失败:', error);
    }
}

// 更新服务状态显示
function updateServiceStatusDisplay() {
    // 在邮箱列表顶部显示服务状态
    if (elements.emailAccountsList) {
        const activeServices = Object.values(serviceStatus).filter(s => s.isActive);
        const totalServices = Object.keys(serviceStatus).length;
        
        let statusHtml = `
            <div class="service-status-panel">
                <div class="status-header">
                    <i class="fas fa-server"></i>
                    <span>邮件服务状态 (${activeServices.length}/${totalServices})</span>
                    <button onclick="checkServiceStatus()" class="refresh-status-btn" title="刷新服务状态">
                        <i class="fas fa-sync-alt"></i>
                    </button>
                </div>
                <div class="status-list">
        `;
        
        for (const [key, service] of Object.entries(serviceStatus)) {
            const statusClass = service.isActive ? 'active' : (service.status === 'error' ? 'error' : 'inactive');
            const statusIcon = service.isActive ? 'check-circle' : (service.status === 'error' ? 'exclamation-circle' : 'times-circle');
            
            statusHtml += `
                <div class="service-item ${statusClass}">
                    <i class="fas fa-${statusIcon}"></i>
                    <span class="service-name">${service.name}</span>
                    <span class="domain-count">${service.domains ? service.domains.length : 0} 域名</span>
                </div>
            `;
        }
        
        statusHtml += `
                </div>
            </div>
        `;
        
        // 将状态面板插入到邮箱列表前面
        const existingStatus = elements.emailAccountsList.querySelector('.service-status-panel');
        if (existingStatus) {
            existingStatus.remove();
        }
        
        elements.emailAccountsList.insertAdjacentHTML('afterbegin', statusHtml);
    }
}

// 处理创建邮箱 - 使用真实服务
function handleCreateEmail(event) {
    event.preventDefault();
    event.stopPropagation();
    
    // 防止重复点击
    if (elements.createEmailBtn.disabled) {
        return;
    }
    
    createNewEmail();
}

// 创建新邮箱 - 对接真实服务，使用kpay+001格式
async function createNewEmail() {
    try {
        setButtonLoading(elements.createEmailBtn, true);
        
        // 检查是否有可用服务
        const activeServices = Object.values(serviceStatus).filter(s => s.isActive);
        if (activeServices.length === 0) {
            throw new Error('当前没有可用的邮件服务，请稍后重试');
        }
        
        showNotification('正在创建kpay格式邮箱地址...', 'info');
        
        // 生成唯一的kpay前缀
        const kpayPrefix = generateUniqueKpayPrefix();
        
        const response = await fetch('/api/create-email', { 
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                customPrefix: kpayPrefix
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const newAccount = {
                id: data.accountId || (Date.now().toString() + '_' + Math.random().toString(36).substring(2)),
                email: data.email,
                displayEmail: data.email, // 使用真实邮箱地址
                token: data.token,
                service: data.service,
                serviceName: data.serviceName,
                username: data.username,
                domain: data.domain,
                prefix: data.prefix || kpayPrefix,
                createdAt: new Date().toISOString(),
                emails: [],
                lastChecked: null,
                isReal: true // 标记为真实邮箱
            };
            
            emailAccounts.push(newAccount);
            saveToStorage();
            updateUI();
            selectEmailAccount(newAccount.id);
            
            showNotification(`邮箱创建成功！地址: ${data.email}`, 'success');
            console.log('创建的邮箱:', newAccount);
        } else {
            throw new Error(data.message || '创建邮箱失败');
        }
    } catch (error) {
        console.error('创建邮箱失败:', error);
        showNotification('创建邮箱失败: ' + error.message, 'error');
    } finally {
        setButtonLoading(elements.createEmailBtn, false);
    }
}

// 生成唯一的kpay前缀
function generateUniqueKpayPrefix() {
    const existingPrefixes = emailAccounts.map(account => {
        if (account.prefix) return account.prefix;
        if (account.email && account.email.includes('@')) {
            return account.email.split('@')[0];
        }
        return '';
    }).filter(prefix => prefix.startsWith('kpay'));
    
    let counter = 1;
    let prefix = '';
    
    do {
        prefix = `kpay${String(counter).padStart(3, '0')}`;
        counter++;
    } while (existingPrefixes.includes(prefix));
    
    return prefix;
}

// 验证邮箱前缀唯一性
function isEmailPrefixUnique(prefix) {
    return !emailAccounts.some(account => {
        if (account.prefix === prefix) return true;
        if (account.email && account.email.startsWith(prefix + '@')) return true;
        return false;
    });
}

// 处理全部刷新
function handleRefreshAll(event) {
    event.preventDefault();
    event.stopPropagation();
    
    if (elements.refreshAllBtn.disabled) {
        return;
    }
    
    refreshAllEmails();
}

// 刷新所有邮箱 - 从真实服务获取
async function refreshAllEmails() {
    if (emailAccounts.length === 0) {
        showNotification('没有邮箱需要刷新', 'info');
        return;
    }
    
    setButtonLoading(elements.refreshAllBtn, true);
    showNotification('正在从真实邮件服务获取邮件...', 'info');
    
    try {
        let totalNewEmails = 0;
        
        for (const account of emailAccounts) {
            try {
                const newEmailCount = await checkEmailsForAccount(account);
                totalNewEmails += newEmailCount;
            } catch (error) {
                console.error(`刷新邮箱 ${account.email} 失败:`, error);
            }
        }
        
        updateUI();
        
        if (totalNewEmails > 0) {
            showNotification(`成功获取 ${totalNewEmails} 封新邮件`, 'success');
        } else {
            showNotification('所有邮箱已刷新，暂无新邮件', 'info');
        }
    } catch (error) {
        console.error('刷新邮箱失败:', error);
        showNotification('刷新失败: ' + error.message, 'error');
    } finally {
        setButtonLoading(elements.refreshAllBtn, false);
    }
}

// 处理复制邮箱地址
function handleCopyEmail(event) {
    event.preventDefault();
    event.stopPropagation();
    
    if (currentAccount) {
        copyToClipboard(currentAccount.email); // 使用真实邮箱地址
    }
}

// 处理刷新当前邮箱
function handleRefreshEmail(event) {
    event.preventDefault();
    event.stopPropagation();
    
    if (elements.refreshEmailBtn.disabled || !currentAccount) {
        return;
    }
    
    refreshCurrentEmail();
}

// 刷新当前邮箱 - 从真实服务获取
async function refreshCurrentEmail() {
    if (!currentAccount) return;
    
    setButtonLoading(elements.refreshEmailBtn, true);
    showNotification(`正在从 ${currentAccount.serviceName || currentAccount.service} 获取邮件...`, 'info');
    
    try {
        const newEmailCount = await checkEmailsForAccount(currentAccount);
        updateEmailsList();
        
        if (newEmailCount > 0) {
            showNotification(`获取到 ${newEmailCount} 封新邮件`, 'success');
        } else {
            showNotification('邮箱已刷新，暂无新邮件', 'info');
        }
    } catch (error) {
        console.error('刷新邮箱失败:', error);
        showNotification('刷新失败: ' + error.message, 'error');
    } finally {
        setButtonLoading(elements.refreshEmailBtn, false);
    }
}

// 处理删除邮箱
function handleDeleteEmail(event) {
    event.preventDefault();
    event.stopPropagation();
    
    if (!currentAccount) return;
    
    if (confirm(`确定要删除邮箱 ${currentAccount.email} 吗？删除后将无法恢复。`)) {
        deleteEmailAccount(currentAccount.id);
    }
}

// 删除邮箱账户
function deleteEmailAccount(accountId) {
    // 停止定时器
    if (refreshIntervals[accountId]) {
        clearInterval(refreshIntervals[accountId]);
        delete refreshIntervals[accountId];
    }
    
    // 从数组中移除
    emailAccounts = emailAccounts.filter(account => account.id !== accountId);
    
    // 如果删除的是当前选中的邮箱
    if (currentAccount && currentAccount.id === accountId) {
        currentAccount = null;
        
        // 如果还有其他邮箱，选择第一个
        if (emailAccounts.length > 0) {
            selectEmailAccount(emailAccounts[0].id);
        }
    }
    
    saveToStorage();
    updateUI();
    showNotification('邮箱已删除', 'success');
}

// 选择邮箱账户
function selectEmailAccount(accountId) {
    const account = emailAccounts.find(acc => acc.id === accountId);
    if (!account || (currentAccount && currentAccount.id === accountId)) {
        return; // 防止重复选择同一个邮箱
    }
    
    // 停止之前的定时器
    if (currentAccount && refreshIntervals[currentAccount.id]) {
        clearInterval(refreshIntervals[currentAccount.id]);
    }
    
    currentAccount = account;
    updateUI();
    updateEmailsList();
    
    // 开始新的定时器
    startEmailCheck(currentAccount);
    
    // 立即检查一次邮件
    checkEmailsForAccount(currentAccount);
}

// 开始邮件检查定时器
function startEmailCheck(account) {
    if (!account) return;
    
    // 清除现有定时器
    if (refreshIntervals[account.id]) {
        clearInterval(refreshIntervals[account.id]);
    }
    
    // 设置新的定时器，每30秒检查一次
    refreshIntervals[account.id] = setInterval(() => {
        checkEmailsForAccount(account);
    }, 30000);
}

// 检查指定账户的邮件 - 从真实服务获取，优化频率，支持Snapmail
async function checkEmailsForAccount(account) {
    if (!account || !account.token) return 0;
    
    // 防止过于频繁的请求：基础15秒 + 若有退避，到期前不请求
    const now = Date.now();
    const minInterval = 15000;
    if (account.backoffUntil && now < account.backoffUntil) {
        return 0;
    }
    if (account.lastCheckTime && (now - account.lastCheckTime) < minInterval) {
        return 0;
    }
    
    try {
        account.lastCheckTime = now;
        console.log(`检查邮件: ${account.email} (${account.serviceName || account.service})`);
        
        // 构建请求URL，为Snapmail添加email参数
        let apiUrl = `/api/emails?token=${encodeURIComponent(account.token)}&service=${encodeURIComponent(account.service)}`;
        
        // 对于所有服务都传递email参数，特别是Snapmail需要
        if (account.email) {
            apiUrl += `&email=${encodeURIComponent(account.email)}`;
        }
        
        const response = await fetch(apiUrl, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
        
        // 限频处理
        if (response.status === 429) {
            const data = await response.json().catch(() => ({}));
            const retry = Number(data.retryAfter || 10);
            const backoff = Math.min((account.backoffStep || 1) * retry * 1000, 60000);
            account.backoffStep = Math.min((account.backoffStep || 1) * 2, 8);
            account.backoffUntil = Date.now() + backoff;
            saveToStorage();
            showNotification(`请求过于频繁，${Math.round(backoff/1000)}秒后自动重试`, 'warning');
            return 0;
        }
        
        const data = await response.json();
        
        if (data.success && Array.isArray(data.emails)) {
            // 成功后重置退避
            account.backoffStep = 1;
            account.backoffUntil = 0;
            const existingIds = new Set(account.emails.map(email => email.id));
            const newEmails = data.emails.filter(email => !existingIds.has(email.id));
            
            if (newEmails.length > 0) {
                // 按时间排序，最新的在前
                newEmails.sort((a, b) => new Date(b.date) - new Date(a.date));
                
                account.emails = [...newEmails, ...account.emails];
                account.lastChecked = new Date().toISOString();
                
                saveToStorage();
                
                // 如果是当前选中的邮箱，更新显示
                if (currentAccount && currentAccount.id === account.id) {
                    updateEmailsList();
                }
                
                updateAccountsList();
                
                // 检查验证码并显示通知
                newEmails.forEach(email => {
                    const verificationCode = extractVerificationCode(email.text || email.textBody || '', email.subject || '');
                    if (verificationCode) {
                        showVerificationPanel(verificationCode);
                        showNotification(`收到新验证码: ${verificationCode}`, 'success');
                    }
                });
                
                console.log(`从 ${account.serviceName || account.service} 获取到 ${newEmails.length} 封新邮件`);
                showNotification(`收到 ${newEmails.length} 封新邮件`, 'info');
            } else {
                console.log(`${account.email}: 暂无新邮件`);
            }
            
            return newEmails.length;
        } else {
            console.warn(`获取邮件失败: ${data.message || '未知错误'}`);
            return 0;
        }
    } catch (error) {
        console.error(`检查邮件失败 (${account.email}):`, error);
        return 0;
    }
}

// 更新UI
function updateUI() {
    updateAccountsList();
    updateCurrentEmailInfo();
    updateEmailsList();
}

// 更新邮箱账户列表
function updateAccountsList() {
    if (!elements.emailAccountsList) return;
    
    // 保留服务状态面板
    const statusPanel = elements.emailAccountsList.querySelector('.service-status-panel');
    
    if (emailAccounts.length === 0) {
        elements.emailAccountsList.innerHTML = `
            <div class="welcome-message">
                <i class="fas fa-inbox"></i>
                <h3>暂无邮箱</h3>
                <p>点击上方"创建新邮箱"开始使用</p>
                <p class="kpay-format">邮箱格式: kpay001@domain.com</p>
            </div>
        `;
        
        // 重新添加状态面板
        if (statusPanel) {
            elements.emailAccountsList.insertAdjacentElement('afterbegin', statusPanel);
        }
        return;
    }
    
    let html = '';
    emailAccounts.forEach(account => {
        const emailCount = account.emails ? account.emails.length : 0;
        const newEmailCount = account.emails ? account.emails.filter(email => !email.seen).length : 0;
        const isActive = currentAccount && currentAccount.id === account.id;
        const serviceName = account.serviceName || account.service || '未知服务';
        const prefix = account.prefix || (account.email ? account.email.split('@')[0] : '');
        
        html += `
            <div class="email-account-item ${isActive ? 'active' : ''}" 
                 onclick="selectEmailAccount('${account.id}')">
                <div class="account-email">
                    <span class="email-prefix">${escapeHtml(prefix)}</span>@${escapeHtml(account.domain || 'unknown')}
                </div>
                <div class="account-info">
                    <span class="service-badge">${serviceName}</span>
                    <span>创建于 ${formatTime(account.createdAt)}</span>
                    ${newEmailCount > 0 ? `<span class="new-email-badge">${newEmailCount} 新</span>` : ''}
                    ${emailCount > 0 ? `<span class="email-count">${emailCount}</span>` : ''}
                </div>
            </div>
        `;
    });
    
    elements.emailAccountsList.innerHTML = html;
    
    // 重新添加状态面板
    if (statusPanel) {
        elements.emailAccountsList.insertAdjacentElement('afterbegin', statusPanel);
    }
}

// 更新当前邮箱信息
function updateCurrentEmailInfo() {
    if (!elements.currentEmailAddress) return;
    
    if (currentAccount) {
        elements.currentEmailAddress.textContent = currentAccount.email; // 显示真实邮箱地址
        
        // 显示操作按钮
        if (elements.copyEmailBtn) elements.copyEmailBtn.style.display = 'inline-block';
        if (elements.refreshEmailBtn) elements.refreshEmailBtn.style.display = 'inline-block';
        if (elements.deleteEmailBtn) elements.deleteEmailBtn.style.display = 'inline-block';
    } else {
        elements.currentEmailAddress.textContent = '请选择或创建邮箱';
        
        // 隐藏操作按钮
        if (elements.copyEmailBtn) elements.copyEmailBtn.style.display = 'none';
        if (elements.refreshEmailBtn) elements.refreshEmailBtn.style.display = 'none';
        if (elements.deleteEmailBtn) elements.deleteEmailBtn.style.display = 'none';
    }
}

// 更新邮件列表
function updateEmailsList() {
    if (!elements.emailsList) return;
    
    if (!currentAccount || !currentAccount.emails || currentAccount.emails.length === 0) {
        const serviceName = currentAccount ? (currentAccount.serviceName || currentAccount.service) : '';
        elements.emailsList.innerHTML = `
            <div class="welcome-message">
                <i class="fas fa-envelope-open-text"></i>
                <h3>暂无邮件</h3>
                <p>等待来自 ${serviceName} 的新邮件...</p>
                ${currentAccount ? `<button onclick="refreshCurrentEmail()" class="refresh-emails-btn">
                    <i class="fas fa-sync-alt"></i> 立即刷新
                </button>` : ''}
            </div>
        `;
        return;
    }
    
    let html = '';
    currentAccount.emails.forEach((email, index) => {
        const verificationCode = extractVerificationCode(email.text || email.textBody || '', email.subject || '');
        const hasVerification = verificationCode !== null;
        const serviceName = email.service || currentAccount.service || '';
        
        html += `
            <div class="email-item" onclick="showEmailDetail(${index})">
                <div class="email-header">
                    <div class="email-from">${escapeHtml(email.from || '未知发件人')}</div>
                    <div class="email-date">${formatTime(email.date || email.createdAt)}</div>
                </div>
                <div class="email-subject">${escapeHtml(email.subject || '无主题')}</div>
                <div class="email-preview">${escapeHtml(stripHtml(email.text || email.textBody || ''))}</div>
                <div class="email-meta">
                    <span class="service-tag">${serviceName}</span>
                    ${hasVerification ? `
                        <div class="verification-badge">
                            <i class="fas fa-key"></i>
                            验证码: ${verificationCode}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    });
    
    elements.emailsList.innerHTML = html;
}

// 显示邮件详情
function showEmailDetail(emailIndex) {
    if (!currentAccount || !currentAccount.emails[emailIndex]) return;
    
    const email = currentAccount.emails[emailIndex];
    
    // 更新模态框内容
    document.getElementById('modalSubject').textContent = email.subject || '无主题';
    document.getElementById('modalFrom').textContent = email.from || '未知发件人';
    document.getElementById('modalDate').textContent = formatTime(email.date || email.createdAt);
    
    // 显示邮件内容（优先显示HTML格式）
    const content = email.html || escapeHtml(email.text || email.textBody || '');
    document.getElementById('modalContent').innerHTML = content;
    
    // 检查验证码
    const verificationCode = extractVerificationCode(email.text || email.textBody || '', email.subject || '');
    const modalVerification = document.getElementById('modalVerification');
    
    if (verificationCode) {
        document.getElementById('modalVerificationCode').textContent = verificationCode;
        modalVerification.style.display = 'block';
        
        // 绑定复制按钮事件
        const copyCodeBtn = document.getElementById('copyCodeBtn');
        if (copyCodeBtn) {
            copyCodeBtn.onclick = () => copyToClipboard(verificationCode);
        }
    } else {
        modalVerification.style.display = 'none';
    }
    
    // 显示模态框
    if (elements.emailModal) {
        elements.emailModal.style.display = 'flex';
    }
}

// 隐藏邮件模态框
function hideEmailModal() {
    if (elements.emailModal) {
        elements.emailModal.style.display = 'none';
    }
}

// 处理模态框背景点击
function handleModalBackgroundClick(event) {
    if (event.target === elements.emailModal) {
        hideEmailModal();
    }
}

// 显示验证码面板
function showVerificationPanel(code) {
    if (!elements.verificationPanel || !elements.verificationResult) return;
    
    elements.verificationResult.innerHTML = `
        <div class="verification-code-display">
            <div class="code-value">${escapeHtml(code)}</div>
            <button class="copy-code-btn" onclick="copyToClipboard('${escapeHtml(code)}')">
                <i class="fas fa-copy"></i> 复制验证码
            </button>
        </div>
    `;
    
    elements.verificationPanel.style.display = 'block';
    
    // 10秒后自动隐藏
    setTimeout(() => {
        hideVerificationPanel();
    }, 10000);
}

// 隐藏验证码面板
function hideVerificationPanel() {
    if (elements.verificationPanel) {
        elements.verificationPanel.style.display = 'none';
    }
}

// 设置按钮加载状态
function setButtonLoading(button, loading) {
    if (!button) return;
    
    if (loading) {
        button.disabled = true;
        button.dataset.originalText = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 处理中...';
    } else {
        button.disabled = false;
        button.innerHTML = button.dataset.originalText || button.innerHTML;
    }
}

// 显示通知
function showNotification(message, type = 'info') {
    if (!elements.notification || !elements.notificationText) return;
    
    elements.notificationText.textContent = message;
    elements.notification.className = `notification ${type}`;
    elements.notification.style.display = 'block';
    
    setTimeout(() => {
        elements.notification.style.display = 'none';
    }, 4000);
}

// 保存到本地存储
function saveToStorage() {
    try {
        localStorage.setItem('realEmailAccounts', JSON.stringify(emailAccounts));
        localStorage.setItem('emailCounter', emailCounter.toString());
        localStorage.setItem('serviceStatus', JSON.stringify(serviceStatus));
    } catch (error) {
        console.error('保存数据失败:', error);
    }
}

// 从本地存储加载数据
function loadStoredData() {
    try {
        const storedAccounts = localStorage.getItem('realEmailAccounts');
        if (storedAccounts) {
            emailAccounts = JSON.parse(storedAccounts);
        }
        
        const storedCounter = localStorage.getItem('emailCounter');
        if (storedCounter) {
            emailCounter = parseInt(storedCounter, 10) || 1;
        }
        
        const storedServiceStatus = localStorage.getItem('serviceStatus');
        if (storedServiceStatus) {
            serviceStatus = JSON.parse(storedServiceStatus);
        }
        
        // 如果有邮箱，选择最后一个
        if (emailAccounts.length > 0) {
            selectEmailAccount(emailAccounts[emailAccounts.length - 1].id);
        }
    } catch (error) {
        console.error('加载数据失败:', error);
        emailAccounts = [];
        emailCounter = 1;
        serviceStatus = {};
    }
}

// 增强型验证码提取算法
function extractVerificationCode(text, subject = '') {
    if (!text && !subject) return null;
    
    const content = (text + ' ' + subject).toLowerCase();
    
    // 验证码匹配模式
    const patterns = [
        /\b(\d{6})\b/g,  // 6位数字
        /\b(\d{5})\b/g,  // 5位数字
        /\b(\d{4})\b/g,  // 4位数字
        /验证码[：:\s]*(\d{4,8})/g,
        /code[：:\s]*(\d{4,8})/g,
        /verification[：:\s]*(\d{4,8})/g,
        /您的.*码.*?(\d{4,8})/g,
        /your.*code.*?(\d{4,8})/g
    ];
    
    for (const pattern of patterns) {
        const matches = content.match(pattern);
        if (matches) {
            for (const match of matches) {
                const numbers = match.match(/\d{4,8}/);
                if (numbers) {
                    return numbers[0];
                }
            }
        }
    }
    
    return null;
}

// 复制到剪贴板
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showNotification('已复制到剪贴板', 'success');
        return true;
    } catch (error) {
        // 降级方案
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        
        try {
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            if (successful) {
                showNotification('已复制到剪贴板', 'success');
            } else {
                showNotification('复制失败', 'error');
            }
            return successful;
        } catch (err) {
            document.body.removeChild(textArea);
            showNotification('复制失败', 'error');
            return false;
        }
    }
}

// 键盘快捷键处理
function handleKeyboardShortcuts(event) {
    // ESC 关闭模态框
    if (event.key === 'Escape') {
        if (elements.emailModal && elements.emailModal.style.display === 'flex') {
            hideEmailModal();
        } else if (elements.verificationPanel && elements.verificationPanel.style.display === 'block') {
            hideVerificationPanel();
        }
    }
    
    // Ctrl+R 刷新当前邮箱
    if (event.ctrlKey && event.key === 'r' && currentAccount) {
        event.preventDefault();
        refreshCurrentEmail();
    }
    
    // Ctrl+C 复制邮箱地址（当没有选中文本时）
    if (event.ctrlKey && event.key === 'c' && currentAccount && window.getSelection().toString() === '') {
        event.preventDefault();
        copyToClipboard(currentAccount.email);
    }
    
    // F5 检查服务状态
    if (event.key === 'F5') {
        event.preventDefault();
        checkServiceStatus();
    }
}

// 工具函数
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function stripHtml(html) {
    if (!html) return '';
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
}

function formatTime(dateString) {
    if (!dateString) return '未知时间';
    
    try {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) {
            return '刚刚';
        } else if (diff < 3600000) {
            return Math.floor(diff / 60000) + '分钟前';
        } else if (diff < 86400000) {
            return Math.floor(diff / 3600000) + '小时前';
        } else {
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        }
    } catch (error) {
        return dateString;
    }
}

// 页面卸载时清理定时器
window.addEventListener('beforeunload', function() {
    Object.values(refreshIntervals).forEach(interval => {
        clearInterval(interval);
    });
});

// 全局函数，供HTML调用
window.selectEmailAccount = selectEmailAccount;
window.showEmailDetail = showEmailDetail;
window.copyToClipboard = copyToClipboard;
window.checkServiceStatus = checkServiceStatus;
window.refreshCurrentEmail = refreshCurrentEmail;