#!/usr/bin/env node

const crypto = require('crypto')
const path = require('path')
const fs = require('fs')
const readline = require('readline')
const admin = require('firebase-admin')

function exitWith(msg, code = 1) { console.error(msg); process.exit(code) }

const args = process.argv.slice(2)
const usage = `\nUsage: node scripts/seedAdmin.js [--username <name>] [--password <plaintext>]\n  or:   npm run seed:admin -- [--username <name>] [--password <plaintext>]\n\nIf not provided, you will be prompted interactively.\nNotes:\n- The password is hashed with SHA-256 before storing.\n- Firestore document: collection 'login', doc 'admin'.\n`

function parseArgs(argv) {
	const out = {}
	for (let i = 0; i < argv.length; i++) {
		const k = argv[i]
		if (k === '--username') { out.username = argv[++i]; continue }
		if (k === '--password') { out.password = argv[++i]; continue }
		if (k === '-h' || k === '--help') { out.help = true }
	}
	return out
}

function prompt(query, { silent = false } = {}) {
	const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
	return new Promise((resolve) => {
		if (!silent) {
			rl.question(query, (ans) => { rl.close(); resolve(ans) })
			return
		}
		// Masked input for password
		const stdin = process.openStdin()
		process.stdin.on('data', (char) => {
			char = char + ''
			if (char === '\n' || char === '\r' || char === '\u0004') process.stdout.write('\n')
			else process.stdout.write('*')
		})
		rl.question(query, (value) => { rl.history = rl.history.slice(1); rl.close(); resolve(value) })
	})
}

async function main() {
	const parsed = parseArgs(args)
	if (parsed.help) exitWith(usage, 0)

	let username = parsed.username
	let password = parsed.password

	if (!username) username = (await prompt('Enter admin username: ')).trim()
	if (!password) password = await prompt('Enter admin password: ', { silent: true })
	if (!username || !password) exitWith(`Missing username or password. ${usage}`)

	// Initialize Firebase Admin using local serviceAccountKey.json
	const keyPath = path.join(__dirname, '..', 'serviceAccountKey.json')
	if (!fs.existsSync(keyPath)) exitWith('serviceAccountKey.json not found in wedding-backend directory')

	if (!admin.apps.length) {
		const serviceAccount = require(keyPath)
		admin.initializeApp({
			credential: admin.credential.cert(serviceAccount),
			projectId: serviceAccount.project_id,
		})
	}
	const db = admin.firestore()

	// Hash password (SHA-256 hex)
	const passwordHash = crypto.createHash('sha256').update(password, 'utf8').digest('hex')

	const ref = db.collection('login').doc('admin')
	await ref.set({ username: String(username).trim(), password: passwordHash }, { merge: true })

	console.log('\n✅ Seeded admin credentials:')
	console.log(`  username: ${username}`)
	console.log(`  passwordHash: ${passwordHash}`)
	console.log('  location: Firestore -> login/admin')
	process.exit(0)
}

main().catch((e) => exitWith(e?.message || String(e))) 