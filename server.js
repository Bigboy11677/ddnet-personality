const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ddnet-personality';

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 连接MongoDB
mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB连接成功'))
  .catch(err => console.error('MongoDB连接失败:', err));

// 定义用户模型
const UserSchema = new mongoose.Schema({
  gameId: { type: String, required: true },
  name: { type: String, required: true },
  personality: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  avatarImage: { type: String, default: '' }
});

// 创建索引优化查询性能
UserSchema.index({ personality: 1, timestamp: -1 });
UserSchema.index({ timestamp: -1 });

const User = mongoose.model('User', UserSchema);

// API路由

// 1. POST /api/users - 提交用户数据
app.post('/api/users', async (req, res) => {
  try {
    const { gameId, name, personality, avatarImage } = req.body;
    
    // 如果用户跳过了取名，不保存
    if (!gameId) {
      return res.json({ success: false, message: '用户未提供游戏ID，跳过存储' });
    }
    
    // 检查是否已存在相同数据，避免重复
    const existingUser = await User.findOne({
      gameId,
      personality
    });
    
    if (existingUser) {
      // 更新现有记录
      existingUser.name = name || gameId;
      existingUser.avatarImage = avatarImage || '';
      existingUser.timestamp = new Date();
      await existingUser.save();
      return res.json({ success: true, message: '数据更新成功', data: existingUser });
    }
    
    const user = new User({
      gameId,
      name: name || gameId,
      personality,
      avatarImage: avatarImage || '',
      timestamp: new Date()
    });
    
    await user.save();
    res.json({ success: true, message: '数据提交成功', data: user });
  } catch (error) {
    console.error('提交数据失败:', error);
    res.json({ success: false, message: '数据提交失败', error: error.message });
  }
});

// 2. GET /api/users/same-personality - 获取相同人格的用户数据
app.get('/api/users/same-personality', async (req, res) => {
  try {
    const { personality, limit = 50 } = req.query;
    
    let query = {};
    if (personality) {
      query.personality = personality;
    }
    
    // 优化查询：只选择需要的字段，使用索引
    const users = await User.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .select('gameId name personality timestamp avatarImage');
    
    res.json({ success: true, message: '获取成功', data: users });
  } catch (error) {
    console.error('获取数据失败:', error);
    res.json({ success: false, message: '获取失败', error: error.message });
  }
});

// 3. GET /api/users - 获取所有用户数据（用于管理页面）
app.get('/api/users', async (req, res) => {
  try {
    // 优化查询：使用索引排序
    const users = await User.find()
      .sort({ timestamp: -1 })
      .select('gameId name personality timestamp avatarImage');
    
    res.json({ success: true, message: '获取成功', data: users });
  } catch (error) {
    console.error('获取数据失败:', error);
    res.json({ success: false, message: '获取失败', error: error.message });
  }
});

// 4. DELETE /api/users/:id - 删除用户数据
app.delete('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await User.findByIdAndDelete(id);
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除数据失败:', error);
    res.json({ success: false, message: '删除失败', error: error.message });
  }
});

// 5. GET /api/statistics - 获取统计数据
app.get('/api/statistics', async (req, res) => {
  try {
    // 使用countDocuments而不是find().length，性能更好
    const totalUsers = await User.countDocuments();
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayUsers = await User.countDocuments({ timestamp: { $gte: today } });
    
    // 使用distinct而不是聚合，性能更好
    const personalities = await User.distinct('personality');
    
    res.json({
      success: true,
      message: '获取成功',
      data: {
        totalUsers,
        todayUsers,
        personalityTypes: personalities.length
      }
    });
  } catch (error) {
    console.error('获取统计数据失败:', error);
    res.json({ success: false, message: '获取失败', error: error.message });
  }
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '服务器运行正常' });
});

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
  console.log(`服务器运行在 http://0.0.0.0:${PORT}`);
});
