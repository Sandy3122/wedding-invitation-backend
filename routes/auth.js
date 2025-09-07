const express = require('express')
const admin = require('firebase-admin')
const crypto = require('crypto')

const router = express.Router()

// Firestore reference
const db = admin.firestore()

// Token config
const TOKEN_TTL_MS = 1000 * 60 * 60 * 12 // 12 hours
const TOKEN_SECRET = process.env.AUTH_TOKEN_SECRET || 'dev-secret-change-me'

function signToken(payload) {
	const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
	const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
	const data = `${header}.${body}`
	const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(data).digest('base64url')
	return `${data}.${sig}`
}

function verifyToken(token) {
	try {
		const [header, body, sig] = String(token || '').split('.')
		if (!header || !body || !sig) return null
		const data = `${header}.${body}`
		const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(data).digest('base64url')
		if (expected !== sig) return null
		const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
		if (payload.exp && Date.now() > payload.exp) return null
		return payload
	} catch { return null }
}

// Helper to load credentials from Firestore
async function getAdminLoginDoc() {
	const docRef = db.collection('login').doc('admin')
	const snap = await docRef.get()
	return { exists: snap.exists, data: snap.exists ? snap.data() : null, ref: docRef }
}

// POST /api/auth/login
// Body: { username: string, passwordHash: string }
router.post('/login', async (req, res) => {
	try {
		const { username, passwordHash } = req.body || {}
		if (typeof username !== 'string' || typeof passwordHash !== 'string' || !username.trim() || !passwordHash.trim()) {
			return res.status(400).json({ success: false, message: 'username and passwordHash are required' })
		}

		const { exists, data } = await getAdminLoginDoc()
		if (!exists) {
			return res.status(404).json({ success: false, message: 'Admin credentials not set' })
		}

		const storedUsername = data.username || 'admin'
		const storedHash = data.password // store hashed password in field "password"

		if (!storedHash || typeof storedHash !== 'string') {
			return res.status(500).json({ success: false, message: 'Stored password hash missing' })
		}

		const usernameOk = username.trim().toLowerCase() === String(storedUsername || '').trim().toLowerCase()
		const passwordOk = passwordHash === storedHash

		if (!usernameOk || !passwordOk) {
			return res.status(401).json({ success: false, message: 'Invalid credentials' })
		}

		const payload = { sub: 'admin', username: storedUsername, iat: Date.now(), exp: Date.now() + TOKEN_TTL_MS }
		const token = signToken(payload)
		return res.json({ success: true, token, expiresInMs: TOKEN_TTL_MS })
	} catch (err) {
		console.error('Auth login error:', err)
		return res.status(500).json({ success: false, message: 'Internal server error' })
	}
})

// GET /api/auth/verify  (Authorization: Bearer <token>)
router.get('/verify', async (req, res) => {
	try {
		const auth = req.header('Authorization') || ''
		const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
		const payload = verifyToken(token)
		if (!payload) return res.status(401).json({ success: false, message: 'Invalid token' })
		return res.json({ success: true, payload })
	} catch (err) {
		console.error('Auth verify error:', err)
		return res.status(500).json({ success: false, message: 'Internal server error' })
	}
})

// Optional: Seed admin credentials securely
// Body: { username: string, passwordHash: string }
// Requires header X-Admin-Seed: process.env.ADMIN_SEED_SECRET
router.post('/seed', async (req, res) => {
	try {
		const guard = req.header('X-Admin-Seed')
		if (!process.env.ADMIN_SEED_SECRET || guard !== process.env.ADMIN_SEED_SECRET) {
			return res.status(403).json({ success: false, message: 'Forbidden' })
		}
		const { username, passwordHash } = req.body || {}
		if (typeof username !== 'string' || typeof passwordHash !== 'string' || !username.trim() || !passwordHash.trim()) {
			return res.status(400).json({ success: false, message: 'username and passwordHash are required' })
		}
		const { ref } = await getAdminLoginDoc()
		await ref.set({ username: username.trim(), password: passwordHash.trim() }, { merge: true })
		return res.json({ success: true })
	} catch (err) {
		console.error('Auth seed error:', err)
		return res.status(500).json({ success: false, message: 'Internal server error' })
	}
})

module.exports = router 