const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
const PORT = Number(process.env.PORT || 3001);

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('.'));
app.set('trust proxy', true);

// 邮件存储文件
const EMAIL_STORAGE_FILE = 'email_storage.json';
const SERVICE_STATUS_FILE = 'service_status.json';

// 第三方邮件服务配置
const EMAIL_SERVICES = {
    'snapmail': {
        name: 'Snapmail',
        baseUrl: 'https://www.snapmail.cc',
        domains: ['snapmail.cc'],
        status: 'unknown',
        lastCheck: null,
        // 用户提供的真实API Key
        apiKey: '73ec91c1-0f33-4503-ab80-0ae1fb9ad830',
        
        // 创建邮箱 - Snapmail不需要创建，直接使用前缀
        createEmail: async function(customPrefix) {
            try {
                const prefix = customPrefix || generateUniqueKpayPrefix();
                const email = `${prefix}@snapmail.cc`;
                
                return {
                    email: email,
                    username: prefix,
                    domain: 'snapmail.cc',
                    token: this.apiKey,
                    service: 'snapmail',
                    prefix: prefix
                };
            } catch (error) {
                throw new Error(`Snapmail创建邮箱失败: ${error.message}`);
            }
        },
        
        // 获取邮件列表（细分404与限频）
        getEmails: async function(token, emailAddress) {
            try {
                if (!emailAddress) {
                    throw new Error('Snapmail需要邮箱地址参数');
                }
                
                console.log(`从Snapmail获取邮件: ${emailAddress}`);
                
                const response = await axios.post(`${this.baseUrl}/emailList/filter`, {
                    key: this.apiKey,
                    emailAddress: emailAddress,
                    isPrefix: true,
                    page: 1,
                    count: 50
                }, {
                    timeout: 15000,
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'TempEmailService/1.0'
                    },
                    validateStatus: () => true
                });
                
                // 细分返回
                if (response.status === 200 && Array.isArray(response.data)) {
                    const emails = response.data.map(email => ({
                        id: `snapmail_${email.id}`,
                        from: email.from && email.from[0] ? email.from[0].address : 'unknown@example.com',
                        subject: email.subject || '无主题',
                        date: email.date || email.time || new Date().toISOString(),
                        text: email.text || '',
                        html: email.html || '',
                        textBody: email.text || '',
                        read: email.read || false,
                        messageId: email.messageId,
                        timestamp: email.timestamp,
                        service: 'snapmail',
                        priority: email.priority || 'normal',
                        to: email.to || [],
                        envelope: email.envelope || {}
                    }));
                    console.log(`Snapmail返回 ${emails.length} 封邮件`);
                    return { success: true, emails };
                }
                
                // 404 not found = 正常无邮件
                if (response.status === 404 && response.data && response.data.error && String(response.data.error).includes('Email was not found')) {
                    return { success: true, emails: [] };
                }
                
                // 429 / 文案包含请稍后再试 = 限频
                const bodyText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
                if (response.status === 429 || bodyText.includes('Please try again')) {
                    return { success: false, code: 'RATE_LIMIT', retryAfter: 10, message: 'Rate limited by Snapmail' };
                }
                
                // 其他错误
                return { success: false, message: `Snapmail错误: ${response.status}` };
            } catch (error) {
                console.error('Snapmail获取邮件失败:', error.message);
                return { success: false, message: error.message || 'Snapmail请求异常' };
            }
        },
        
        // 检查服务状态
        checkStatus: async function() {
            try {
                // 测试API连接
                const testResponse = await axios.post(`${this.baseUrl}/emailList/filter`, {
                    key: this.apiKey,
                    emailAddress: 'test@snapmail.cc',
                    isPrefix: true,
                    page: 1,
                    count: 1
                }, {
                    timeout: 10000,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                // 如果请求成功（即使没有邮件），说明服务可用
                this.status = 'active';
                this.lastCheck = new Date().toISOString();
                return true;
            } catch (error) {
                // 404错误且包含"Email was not found"表示API可用，只是没有邮件
                if (error.response && error.response.status === 404 && 
                    error.response.data && error.response.data.error && 
                    error.response.data.error.includes('Email was not found')) {
                    console.log('Snapmail API可用 (测试邮箱无邮件，这是正常的)');
                    this.status = 'active';
                    this.lastCheck = new Date().toISOString();
                    return true;
                }
                
                console.error('Snapmail状态检查失败:', error.message);
                this.status = 'error';
                this.lastCheck = new Date().toISOString();
                return false;
            }
        }
    },
    
    // 可靠兜底：Mail.tm
    'mailtm': {
        name: 'Mail.tm',
        baseUrl: 'https://api.mail.tm',
        status: 'unknown',
        lastCheck: null,
        domainsCache: [],
        // 创建邮箱（地址/密码）并获取JWT
        createEmail: async function(customPrefix) {
            const prefix = customPrefix || generateUniqueKpayPrefix();
            // 取一个可用域名
            const domainsResp = await axios.get(`${this.baseUrl}/domains`, { timeout: 10000 });
            const domainObj = (domainsResp.data && domainsResp.data['hydra:member'] && domainsResp.data['hydra:member'][0]) || { domain: 'example.com' };
            const address = `${prefix}@${domainObj.domain}`;
            const password = crypto.randomBytes(8).toString('hex');
            // 创建账户
            await axios.post(`${this.baseUrl}/accounts`, { address, password }, { timeout: 15000, validateStatus: ()=>true });
            // 获取token
            const tokenResp = await axios.post(`${this.baseUrl}/token`, { address, password }, { timeout: 15000 });
            const token = tokenResp.data && tokenResp.data.token;
            return { email: address, username: prefix, domain: domainObj.domain, token, service: 'mailtm', prefix };
        },
        // 拉取邮件
        getEmails: async function(jwt) {
            const resp = await axios.get(`${this.baseUrl}/messages`, {
                timeout: 15000,
                headers: { Authorization: `Bearer ${jwt}` },
                validateStatus: ()=>true
            });
            if (resp.status === 200 && resp.data && resp.data['hydra:member']) {
                return resp.data['hydra:member'].map(m => ({
                    id: `mailtm_${m.id}`,
                    from: (m.from && m.from.address) || 'unknown@example.com',
                    subject: m.subject || '无主题',
                    date: m.intro || new Date().toISOString(),
                    text: m.intro || '',
                    html: '',
                    textBody: m.intro || '',
                    service: 'mailtm'
                }));
            }
            return [];
        },
        checkStatus: async function() {
            try {
                const resp = await axios.get(`${this.baseUrl}/domains`, { timeout: 8000 });
                this.status = (resp.status === 200) ? 'active' : 'inactive';
                this.lastCheck = new Date().toISOString();
                return this.status === 'active';
            } catch {
                this.status = 'error';
                this.lastCheck = new Date().toISOString();
                return false;
            }
        }
    },
    
    'guerrillamail': {
        name: 'GuerrillaMail',
        baseUrl: 'https://api.guerrillamail.com/ajax.php',
        domains: ['guerrillamail.info', 'guerrillamail.biz', 'guerrillamail.com', 'guerrillamail.de', 'guerrillamail.net', 'guerrillamail.org'],
        status: 'unknown',
        lastCheck: null,
        
        createEmail: async function(customPrefix) {
            try {
                // 如果提供了自定义前缀，尝试设置邮箱地址
                if (customPrefix) {
                    const setEmailResponse = await axios.get(`${this.baseUrl}?f=set_email_user&email_user=${customPrefix}&lang=en&site=guerrillamail.com`, {
                        timeout: 10000
                    });
                    
                    if (setEmailResponse.data && setEmailResponse.data.email_addr) {
                        const email = setEmailResponse.data.email_addr;
                        const [username, domain] = email.split('@');
                        
                        return {
                            email: email,
                            username: username,
                            domain: domain,
                            token: setEmailResponse.data.sid_token || email,
                            service: 'guerrillamail',
                            prefix: username
                        };
                    }
                }
                
                // 如果自定义前缀失败或未提供，使用默认方式
                const response = await axios.get(`${this.baseUrl}?f=get_email_address`, {
                    timeout: 10000
                });
                
                if (response.data && response.data.email_addr) {
                    const email = response.data.email_addr;
                    const [username, domain] = email.split('@');
                    
                    return {
                        email: email,
                        username: username,
                        domain: domain,
                        token: response.data.sid_token || email,
                        service: 'guerrillamail',
                        prefix: username
                    };
                }
                
                throw new Error('无法获取邮箱地址');
            } catch (error) {
                throw new Error(`GuerrillaMail创建邮箱失败: ${error.message}`);
            }
        },
        
        getEmails: async function(token) {
            try {
                const response = await axios.get(`${this.baseUrl}?f=get_email_list&sid_token=${encodeURIComponent(token)}`, {
                    timeout: 10000
                });
                
                if (!response.data || !Array.isArray(response.data.list)) {
                    return [];
                }
                
                const emails = [];
                for (const email of response.data.list) {
                    try {
                        const detailResponse = await axios.get(`${this.baseUrl}?f=fetch_email&sid_token=${encodeURIComponent(token)}&email_id=${email.mail_id}`, {
                            timeout: 10000
                        });
                        
                        const emailData = detailResponse.data;
                        
                        // 处理邮件内容
                        let textContent = '';
                        let htmlContent = '';
                        
                        if (emailData.mail_body) {
                            if (emailData.mail_body.includes('<') && emailData.mail_body.includes('>')) {
                                htmlContent = emailData.mail_body;
                                textContent = emailData.mail_body.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
                            } else {
                                textContent = emailData.mail_body;
                                htmlContent = emailData.mail_body.replace(/\n/g, '<br>');
                            }
                        }
                        
                        emails.push({
                            id: `guerrillamail_${email.mail_id}`,
                            from: emailData.mail_from || email.mail_from || 'unknown@example.com',
                            subject: emailData.mail_subject || email.mail_subject || '无主题',
                            date: emailData.mail_timestamp ? new Date(emailData.mail_timestamp * 1000).toISOString() : new Date().toISOString(),
                            text: textContent,
                            html: htmlContent,
                            textBody: textContent,
                            service: 'guerrillamail',
                            size: emailData.mail_size || 0,
                            read: emailData.mail_read || false
                        });
                    } catch (detailError) {
                        console.error(`获取GuerrillaMail邮件详情失败:`, detailError.message);
                    }
                }
                
                return emails;
            } catch (error) {
                throw new Error(`GuerrillaMail获取邮件失败: ${error.message}`);
            }
        },
        
        checkStatus: async function() {
            try {
                const response = await axios.get(`${this.baseUrl}?f=get_email_address`, {
                    timeout: 5000
                });
                
                if (response.data && response.data.email_addr) {
                    this.status = 'active';
                    this.lastCheck = new Date().toISOString();
                    return true;
                }
                
                this.status = 'inactive';
                return false;
            } catch (error) {
                this.status = 'error';
                this.lastCheck = new Date().toISOString();
                return false;
            }
        }
    }
};

// 初始化存储文件
function initStorage() {
    if (!fs.existsSync(EMAIL_STORAGE_FILE)) {
        fs.writeFileSync(EMAIL_STORAGE_FILE, JSON.stringify({}));
    }
    if (!fs.existsSync(SERVICE_STATUS_FILE)) {
        fs.writeFileSync(SERVICE_STATUS_FILE, JSON.stringify({}));
    }
}

// 读取邮件存储
function readEmailStorage() {
    try {
        const data = fs.readFileSync(EMAIL_STORAGE_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return {};
    }
}

// 写入邮件存储
function writeEmailStorage(data) {
    fs.writeFileSync(EMAIL_STORAGE_FILE, JSON.stringify(data, null, 2));
}

// 读取服务状态
function readServiceStatus() {
    try {
        const data = fs.readFileSync(SERVICE_STATUS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return {};
    }
}

// 写入服务状态
function writeServiceStatus(data) {
    fs.writeFileSync(SERVICE_STATUS_FILE, JSON.stringify(data, null, 2));
}

// 生成随机字符串
function generateRandomString(length) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// 生成唯一的kpay前缀
function generateUniqueKpayPrefix() {
    const storage = readEmailStorage();
    const existingEmails = Object.values(storage).flatMap(account => 
        account.email ? [account.email] : []
    );
    
    let counter = 1;
    let prefix = '';
    
    do {
        prefix = `kpay${String(counter).padStart(3, '0')}`;
        counter++;
    } while (existingEmails.some(email => email.startsWith(prefix + '@')));
    
    return prefix;
}

// 验证邮箱前缀唯一性
function isEmailPrefixUnique(prefix) {
    const storage = readEmailStorage();
    const existingEmails = Object.values(storage).flatMap(account => 
        account.email ? [account.email] : []
    );
    
    return !existingEmails.some(email => email.startsWith(prefix + '@'));
}

// 选择可用的邮件服务
function selectAvailableService() {
    const activeServices = Object.entries(EMAIL_SERVICES).filter(([key, service]) => service.status === 'active');
    
    if (activeServices.length === 0) {
        // 优先使用Snapmail
        return 'snapmail';
    }
    
    // 优先选择Snapmail，如果可用的话
    const snapmailActive = activeServices.find(([key]) => key === 'snapmail');
    if (snapmailActive) {
        return 'snapmail';
    }
    
    // 否则随机选择一个活跃的服务
    const randomIndex = Math.floor(Math.random() * activeServices.length);
    return activeServices[randomIndex][0];
}

// API路由

// 获取服务状态
app.get('/api/service-status', async (req, res) => {
    try {
        const status = {};
        
        for (const [key, service] of Object.entries(EMAIL_SERVICES)) {
            status[key] = {
                name: service.name,
                status: service.status,
                lastCheck: service.lastCheck,
                domains: service.domains,
                isActive: service.status === 'active'
            };
        }
        
        res.json({
            success: true,
            services: status,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '获取服务状态失败',
            error: error.message
        });
    }
});

// 检查所有服务状态
app.post('/api/check-services', async (req, res) => {
    try {
        const results = {};
        
        for (const [key, service] of Object.entries(EMAIL_SERVICES)) {
            try {
                console.log(`检查服务状态: ${service.name}`);
                const isActive = await service.checkStatus();
                results[key] = {
                    name: service.name,
                    status: service.status,
                    lastCheck: service.lastCheck,
                    domains: service.domains,
                    isActive: isActive
                };
            } catch (error) {
                results[key] = {
                    name: service.name,
                    status: 'error',
                    lastCheck: new Date().toISOString(),
                    error: error.message,
                    isActive: false
                };
            }
        }
        
        // 保存服务状态
        writeServiceStatus(results);
        
        res.json({
            success: true,
            results: results,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '检查服务状态失败',
            error: error.message
        });
    }
});

// 创建邮箱
app.post('/api/create-email', async (req, res) => {
    try {
        const { service: preferredService, customPrefix } = req.body;
        
        // 选择服务，优先使用Snapmail
        let serviceKey = preferredService || selectAvailableService();
        let service = EMAIL_SERVICES[serviceKey];
        
        if (!service) {
            serviceKey = 'snapmail'; // 默认使用Snapmail
            service = EMAIL_SERVICES[serviceKey];
        }
        
        console.log(`使用服务创建邮箱: ${service.name}`);
        
        // 生成唯一的kpay前缀
        let emailPrefix = customPrefix;
        if (!emailPrefix) {
            emailPrefix = generateUniqueKpayPrefix();
        } else {
            // 验证自定义前缀的唯一性
            if (!isEmailPrefixUnique(emailPrefix)) {
                return res.status(400).json({
                    success: false,
                    message: '邮箱前缀已存在，请使用其他前缀'
                });
            }
        }
        
        // 创建邮箱
        const emailData = await service.createEmail(emailPrefix);
        
        // 保存邮箱信息到存储
        const storage = readEmailStorage();
        const accountId = Date.now().toString();
        storage[accountId] = {
            email: emailData.email,
            token: emailData.token,
            service: emailData.service,
            prefix: emailData.prefix || emailPrefix,
            createdAt: new Date().toISOString(),
            emails: []
        };
        writeEmailStorage(storage);
        
        console.log(`邮箱创建成功: ${emailData.email}`);
        
        res.json({
            success: true,
            ...emailData,
            serviceName: service.name,
            availableDomains: service.domains,
            accountId: accountId,
            prefix: emailData.prefix || emailPrefix
        });
    } catch (error) {
        console.error('创建邮箱失败:', error);
        res.status(500).json({
            success: false,
            message: error.message || '创建邮箱失败'
        });
    }
});

// 获取邮件
app.get('/api/emails', async (req, res) => {
    try {
        const { token, service: serviceKey, email } = req.query;
        
        if (!token) {
            return res.status(400).json({
                success: false,
                message: '缺少token参数'
            });
        }
        
        // 确定使用的服务
        let service;
        if (serviceKey && EMAIL_SERVICES[serviceKey]) {
            service = EMAIL_SERVICES[serviceKey];
        } else {
            // 默认使用Snapmail
            service = EMAIL_SERVICES['snapmail'];
        }
        
        if (!service) {
            return res.status(400).json({
                success: false,
                message: '无法确定邮件服务类型'
            });
        }
        
        console.log(`获取邮件: ${service.name}, Email: ${email || 'N/A'}`);
        
        let result;
        
        // 根据服务类型调用不同的获取方法
        if (service.name === 'Snapmail') {
            if (!email) {
                return res.status(400).json({
                    success: false,
                    message: 'Snapmail服务需要邮箱地址参数'
                });
            }
            result = await service.getEmails(token, email);
        } else {
            const list = await service.getEmails(token);
            result = { success: true, emails: list };
        }
        
        if (result && result.success) {
            res.json({
                success: true,
                emails: result.emails || [],
                service: service.name,
                count: (result.emails || []).length,
                timestamp: new Date().toISOString()
            });
        } else if (result && result.code === 'RATE_LIMIT') {
            res.status(429).json({
                success: false,
                code: 'RATE_LIMIT',
                retryAfter: result.retryAfter || 10,
                message: result.message || 'Rate limited'
            });
        } else {
            res.status(502).json({
                success: false,
                message: (result && result.message) || '第三方服务错误'
            });
        }
    } catch (error) {
        console.error('获取邮件失败:', error);
        res.status(500).json({
            success: false,
            message: error.message || '获取邮件失败'
        });
    }
});

// 获取可用域名
app.get('/api/domains', async (req, res) => {
    try {
        const allDomains = [];
        
        for (const [key, service] of Object.entries(EMAIL_SERVICES)) {
            if (service.status === 'active' && service.domains) {
                allDomains.push(...service.domains.map(domain => ({
                    domain: domain,
                    service: key,
                    serviceName: service.name
                })));
            }
        }
        
        res.json({
            success: true,
            domains: allDomains,
            count: allDomains.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '获取域名列表失败',
            error: error.message
        });
    }
});

// 邮件持久化API
app.post('/api/save-emails', (req, res) => {
    try {
        const { accountId, emails } = req.body;
        
        if (!accountId || !emails) {
            return res.status(400).json({
                success: false,
                message: '缺少必要参数'
            });
        }

        const storage = readEmailStorage();
        if (storage[accountId]) {
            storage[accountId].emails = emails;
            storage[accountId].lastUpdated = new Date().toISOString();
        } else {
            storage[accountId] = {
                emails: emails,
                lastUpdated: new Date().toISOString()
            };
        }
        writeEmailStorage(storage);
        
        res.json({
            success: true,
            message: '邮件保存成功',
            count: emails.length
        });
    } catch (error) {
        console.error('保存邮件失败:', error);
        res.status(500).json({
            success: false,
            message: '保存邮件失败'
        });
    }
});

// 获取持久化邮件API
app.get('/api/load-emails', (req, res) => {
    try {
        const { accountId } = req.query;
        
        if (!accountId) {
            return res.status(400).json({
                success: false,
                message: '缺少accountId参数'
            });
        }

        const storage = readEmailStorage();
        const accountData = storage[accountId] || { emails: [] };
        
        res.json({
            success: true,
            emails: accountData.emails || [],
            lastUpdated: accountData.lastUpdated
        });
    } catch (error) {
        console.error('加载邮件失败:', error);
        res.status(500).json({
            success: false,
            message: '加载邮件失败'
        });
    }
});

// 服务静态文件
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 初始化并启动服务器
initStorage();

// 启动时检查所有服务状态
async function initializeServices() {
    console.log('正在检查第三方邮件服务状态...');
    
    for (const [key, service] of Object.entries(EMAIL_SERVICES)) {
        try {
            console.log(`检查 ${service.name}...`);
            await service.checkStatus();
            console.log(`${service.name}: ${service.status}`);
        } catch (error) {
            console.error(`${service.name} 检查失败:`, error.message);
        }
    }
    
    const activeServices = Object.values(EMAIL_SERVICES).filter(s => s.status === 'active');
    console.log(`\n可用服务数量: ${activeServices.length}/${Object.keys(EMAIL_SERVICES).length}`);
    
    if (activeServices.length === 0) {
        console.warn('警告: 没有可用的邮件服务！将使用Snapmail作为默认服务。');
    }
}

const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, async () => {
    const hostToShow = process.env.PUBLIC_HOST || 'localhost';
    console.log(`临时邮箱服务运行在 http://${hostToShow}:${PORT}`);
    console.log('集成Snapmail API，支持真实邮件接收');
    console.log('邮件数据将持久化保存到 email_storage.json 文件中');
    console.log('服务状态将保存到 service_status.json 文件中');
    
    // 初始化服务状态
    await initializeServices();
    
    console.log('\n=== 服务初始化完成 ===');
    console.log('邮箱格式: kpay001@snapmail.cc');
    console.log('支持真实邮件接收和验证码检测');
});

module.exports = app;