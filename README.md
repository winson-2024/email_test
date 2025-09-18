# 临时邮箱服务

## 项目概述
这是一个完整的临时邮箱服务，解决了用户提到的两个核心问题：
1. **邮件持久化存储** - 刷新页面后邮件不会消失
2. **验证码检测准确性** - 验证码提取算法优化

## 已解决的问题

### 1. 邮件持久化存储问题
- ✅ 使用本地文件存储 (`email_storage.json`) 保存所有邮件数据
- ✅ 刷新页面后自动从存储中恢复邮件列表
- ✅ 支持多个邮箱账户的邮件分离存储

### 2. 验证码不一致问题  
- ✅ 增强型验证码识别算法，支持多种验证码格式
- ✅ 正则表达式模式匹配，提高识别准确率
- ✅ 支持4-8位数字验证码提取

## 功能特性

### 核心功能
- 🎯 创建临时邮箱地址
- 📧 实时接收和显示邮件
- 🔍 智能验证码检测和提取  
- 💾 邮件数据持久化存储
- 🔄 页面刷新后数据恢复

### 验证码识别支持
- 纯数字验证码 (4-8位)
- 包含"验证码："前缀的文本
- 包含"code："或"verification："的英文邮件
- HTML格式邮件中的验证码提取

## 技术实现

### 前端技术
- HTML5 + CSS3 + JavaScript
- localStorage 本地存储
- Fetch API 异步请求

### 后端技术  
- Node.js + Express.js
- 文件系统持久化存储
- CORS 跨域支持

### 验证码识别算法
```javascript
function extractVerificationCode(content) {
    const patterns = [
        /\b\d{4,8}\b/,
        /验证码[：:]\s*(\d{4,8})/,
        /code[：:]\s*(\d{4,8})/i,
        /verification[：:]\s*(\d{4,8})/i
    ];
    // 模式匹配逻辑...
}
```

## 安装和运行

1. 安装依赖：
```bash
npm install
```

2. 启动服务器：
```bash
node server.js
```

3. 访问应用：
打开浏览器访问 http://localhost:3000

## 项目结构
```
├── index.html          # 主页面
├── styles.css          # 样式文件  
├── script.js           # 前端逻辑
├── server.js           # 后端服务器
├── package.json        # 项目配置
├── email_storage.json  # 邮件存储文件 (自动生成)
└── README.md          # 项目说明
```

## API接口

### 创建邮箱
- `POST /api/create-email`
- 返回：邮箱地址和token

### 获取邮件  
- `GET /api/emails?token=xxx`
- 返回：邮件列表

### 保存邮件
- `POST /api/save-emails`
- 参数：accountId, emails

### 加载邮件
- `GET /api/load-emails?accountId=xxx`
- 返回：持久化的邮件列表

## 使用说明

1. 点击"生成邮箱"创建临时邮箱
2. 使用该邮箱地址接收邮件
3. 邮件会自动显示在列表中
4. 验证码会自动检测并高亮显示
5. 刷新页面后邮件数据会自动恢复

## 注意事项

- 邮件数据保存在本地文件中，重启服务器不会丢失
- 验证码识别基于正则表达式，可能无法识别所有格式
- 建议定期清理 `email_storage.json` 文件