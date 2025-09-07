#!/usr/bin/env node

const crypto = require('crypto')
const path = require('path')
const fs = require('fs')
const readline = require('readline')
const admin = require('firebase-admin')

function exitWith(msg, code = 1) { console.error(msg); process.exit(code) }

function prompt(query, { silent = false } = {}) {
	const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
	return new Promise((resolve) => {
		if (!silent) return rl.question(query, (ans) => { rl.close(); resolve(ans) })
		process.stdin.on('data', (char) => { char = char + ''; if (['\n','\r','\u0004'].includes(char)) process.stdout.write('\n'); else process.stdout.write('*') })
		rl.question(query, (v) => { rl.history = rl.history.slice(1); rl.close(); resolve(v) })
	})
}

async function main() {
	const keyPath = path.join(__dirname, '..', 'serviceAccountKey.json')
	if (!fs.existsSync(keyPath)) exitWith('serviceAccountKey.json not found')
	if (!admin.apps.length) {
		const sa = require(keyPath)
		admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id })
	}
	const db = admin.firestore()

	const doc = await db.collection('login').doc('admin').get()
	if (!doc.exists) exitWith('No credentials found at login/admin')
	const data = doc.data()
	const storedUser = data?.username
	const storedHash = data?.password
	console.log('Stored Firestore credentials:')
	console.log(`  username: ${storedUser}`)
	console.log(`  passwordHash: ${storedHash}`)

	const username = (await prompt('Enter username to test: ')).trim()
	const password = await prompt('Enter password to test: ', { silent: true })
	const testHash = crypto.createHash('sha256').update(password, 'utf8').digest('hex')
	const userOk = username.trim().toLowerCase() === String(storedUser || '').trim().toLowerCase()
	const passOk = testHash === storedHash
	console.log(`\nMatch -> username: ${userOk}, password: ${passOk}`)
	process.exit(userOk && passOk ? 0 : 2)
}

main().catch((e) => exitWith(e?.message || String(e))) 