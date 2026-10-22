// Chép bài blog CÔNG KHAI của icards.com.vn (chỉ đọc qua API công khai) vào database tạm của môi trường thử.
const path = require('path');
const BE = '/Users/gmall/Desktop/ICARDS/icards-backend-master';
const mongoose = require(path.join(BE, 'node_modules/mongoose'));
const { mongoUri } = require('./test-user.json');
const oid = (v) => (v && mongoose.Types.ObjectId.isValid(v) ? new mongoose.Types.ObjectId(String(v)) : null);
(async () => {
  const [pages, cats, topics] = await Promise.all([
    fetch('https://api.icards.com.vn/api/pages').then(r => r.json()),
    fetch('https://api.icards.com.vn/api/public/page-categories').then(r => r.json()),
    fetch('https://api.icards.com.vn/api/public/topics').then(r => r.json()),
  ]);
  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;
  const flat = [];
  const walk = (nodes, parent) => (nodes || []).forEach(n => { flat.push({ _id: oid(n._id), name: n.name, slug: n.slug, parent: oid(parent), order: n.order || 0 }); walk(n.children, n._id); });
  walk(cats.data, null);
  const tflat = [];
  const twalk = (nodes) => (nodes || []).forEach(n => { tflat.push({ _id: oid(n._id), name: n.name, slug: n.slug, order: n.order || 0 }); twalk(n.children); });
  twalk(topics.data);
  await db.collection('pagecategories').deleteMany({}); await db.collection('topics').deleteMany({}); await db.collection('pages').deleteMany({});
  if (flat.length) await db.collection('pagecategories').insertMany(flat);
  if (tflat.length) await db.collection('topics').insertMany(tflat);
  const docs = pages.data.map(p => ({
    _id: oid(p._id), title: p.title, slug: p.slug, content: p.content || '', isBlog: !!p.isBlog, isPublished: true,
    category: oid(p.category?._id || p.category), topics: (p.topics || []).map(t => oid(t?._id || t)).filter(Boolean),
    thumbnail: p.thumbnail || '', seo: p.seo || {}, injectedBlocks: [], createdAt: new Date(p.createdAt), updatedAt: new Date(p.updatedAt),
  }));
  await db.collection('pages').insertMany(docs);
  console.log('seeded', docs.length, 'pages,', flat.length, 'categories,', tflat.length, 'topics');
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
