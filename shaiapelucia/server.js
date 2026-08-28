const express = require('express');
const cors = require('cors');
const pool = require('./db');

const app = express();
app.use(cors());
app.use(express.static('public'));
app.use(express.json());

// Listar produtos
app.get('/api/produtos', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT p.*, c.nome AS categoria 
     FROM produtos p 
     JOIN categorias c ON p.id_categoria = c.id_categoria 
     WHERE p.ativo = TRUE`
  );
  res.json(rows);
});

// Criar pedido
app.post('/api/pedidos', async (req, res) => {
  const { id_cliente, forma_pagamento, itens } = req.body;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [pedido] = await conn.query(
      'INSERT INTO pedidos (id_cliente, forma_pagamento) VALUES (?, ?)',
      [id_cliente, forma_pagamento]
    );
    for (const item of itens) {
    await conn.query(
      'INSERT INTO itens_pedido (id_pedido, id_produto, quantidade, preco_unitario, nome_personalizado) VALUES (?, ?, ?, ?, ?)',
      [pedido.insertId, item.id_produto, item.quantidade, item.preco_unitario, item.nome_personalizado || null]
      );
    }
    await conn.commit();
    res.json({ id_pedido: pedido.insertId });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ erro: err.message });
  } finally {
    conn.release();
  }
  
});

// Busca cliente pelo nome, ou cria se não existir
app.post('/api/clientes', async (req, res) => {
  const { nome } = req.body;
  if (!nome || !nome.trim()) {
    return res.status(400).json({ erro: 'Nome do cliente é obrigatório.' });
  }
  const nomeLimpo = nome.trim();
  try {
    const [existentes] = await pool.query(
      'SELECT id_cliente FROM clientes WHERE nome = ? LIMIT 1',
      [nomeLimpo]
    );
    if (existentes.length > 0) {
      return res.json({ id_cliente: existentes[0].id_cliente, novo: false });
    }
    const [resultado] = await pool.query(
      'INSERT INTO clientes (nome) VALUES (?)',
      [nomeLimpo]
    );
    res.json({ id_cliente: resultado.insertId, novo: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// CADASTRO E LOGIN
const bcrypt = require('bcryptjs');

// Criar conta
app.post('/api/cadastro', async (req, res) => {
  const { nome, email, senha } = req.body;
  if (!nome || !email || !senha) {
    return res.status(400).json({ erro: 'Nome, e-mail e senha são obrigatórios.' });
  }
  if (senha.length < 6) {
    return res.status(400).json({ erro: 'A senha precisa ter pelo menos 6 caracteres.' });
  }
  try {
    const [existentes] = await pool.query('SELECT id_cliente FROM clientes WHERE email = ?', [email]);
    if (existentes.length > 0) {
      return res.status(409).json({ erro: 'Já existe uma conta com esse e-mail.' });
    }
    const senhaHash = await bcrypt.hash(senha, 10);
    const [resultado] = await pool.query(
      'INSERT INTO clientes (nome, email, senha) VALUES (?, ?, ?)',
      [nome, email, senhaHash]
    );
    res.json({ id_cliente: resultado.insertId, nome, email });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) {
    return res.status(400).json({ erro: 'E-mail e senha são obrigatórios.' });
  }
  try {
    const [rows] = await pool.query('SELECT * FROM clientes WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
    }
    const cliente = rows[0];
    const senhaCorreta = await bcrypt.compare(senha, cliente.senha);
    if (!senhaCorreta) {
      return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
    }
    res.json({ id_cliente: cliente.id_cliente, nome: cliente.nome, email: cliente.email });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Atualiza CPF e telefone do cliente logado
app.put('/api/clientes/:id', async (req, res) => {
  const { id } = req.params;
  const { cpf, telefone } = req.body;
  try {
    await pool.query(
      'UPDATE clientes SET cpf = ?, telefone = ? WHERE id_cliente = ?',
      [cpf || null, telefone || null, id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Cria um endereço vinculado a um cliente
app.post('/api/enderecos', async (req, res) => {
  const { fk_id_cliente, rua, bairro, numero, cep } = req.body;
  if (!fk_id_cliente || !rua || !bairro || !numero) {
    return res.status(400).json({ erro: 'Rua, bairro e número são obrigatórios.' });
  }
  try {
    const [resultado] = await pool.query(
      'INSERT INTO enderecos (fk_id_cliente, rua, bairro, numero, cep) VALUES (?, ?, ?, ?, ?)',
      [fk_id_cliente, rua, bairro, numero, cep || null]
    );
    res.json({ id_endereco: resultado.insertId });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});
app.listen(3000, () => console.log('API rodando na porta 3000'));