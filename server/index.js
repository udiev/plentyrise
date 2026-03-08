const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const { connectSQL } = require('./db/sql');
const { connectCosmos } = require('./db/cosmos');

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/v1/auth',        require('./routes/auth'));
app.use('/api/v1/assets',      require('./routes/assets'));
app.use('/api/v1/investments', require('./routes/investments'));
app.use('/api/v1/real-estate', require('./routes/realEstate'));
app.use('/api/v1/crypto',      require('./routes/crypto'));
app.use('/api/v1/cash',        require('./routes/cash'));
app.use('/api/v1/pension',     require('./routes/pension'));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 3001;

async function start() {
  try {
    await connectSQL();
    console.log('✅ Azure SQL connected');
    await connectCosmos();
    console.log('✅ Cosmos DB connected');
    app.listen(PORT, () => console.log(`🚀 PlentyRise API running on port ${PORT}`));
  } catch (err) {
    console.error('❌ Startup failed:', err);
    process.exit(1);
  }
}

start();
