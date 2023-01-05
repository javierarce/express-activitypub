require('dotenv').config()

const fs = require('fs')
const express = require('express')
const app = express()
const Database = require('better-sqlite3')
const db = new Database('bot-node.db')
const routes = require('./routes')
const bodyParser = require('body-parser')
const cors = require('cors')
const http = require('http')
const basicAuth = require('express-basic-auth')

const USER = process.env.USER
const PASS = process.env.PASS
const DOMAIN = process.env.DOMAIN
const PRIVKEY_PATH = process.env.PRIVKEY_PATH
const CERT_PATH = process.env.CERT_PATH

try {
  const sslOptions = {
    key: fs.readFileSync(PRIVKEY_PATH),
    cert: fs.readFileSync(CERT_PATH)
  }
} catch(error) {
  if (error.errno === -2) {
    console.error('No SSL key and/or cert found, not enabling https server')
  }
  else {
    console.error(error)
  }
}

// if there is no `accounts` table in the DB, create an empty table
db.prepare('CREATE TABLE IF NOT EXISTS accounts (name TEXT PRIMARY KEY, privkey TEXT, pubkey TEXT, webfinger TEXT, actor TEXT, apikey TEXT, followers TEXT, messages TEXT)').run()

// if there is no `messages` table in the DB, create an empty table
db.prepare('CREATE TABLE IF NOT EXISTS messages (guid TEXT PRIMARY KEY, message TEXT)').run()

app.set('db', db)
app.set('domain', DOMAIN)
app.set('port', process.env.PORT || 3000)
app.set('port-https', process.env.PORT_HTTPS || 8443)
app.use(bodyParser.json({type: 'application/activity+json'})); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

// basic http authorizer
const basicUserAuth = basicAuth({
  authorizer: asyncAuthorizer,
  authorizeAsync: true,
  challenge: true
})

function asyncAuthorizer(username, password, cb) {
  let isAuthorized = false
  const isPasswordAuthorized = username === USER
  const isUsernameAuthorized = password === PASS
  isAuthorized = isPasswordAuthorized && isUsernameAuthorized
  if (isAuthorized) {
    return cb(null, true)
  }
  else {
    return cb(null, false)
  }
}

app.get('/', (req, res) => res.send('Hello World!'))

app.options('/api', cors())

app.use('/api', cors(), routes.api)
app.use('/api/admin', cors({ credentials: true, origin: true }), basicUserAuth, routes.admin)

app.use('/admin', express.static('public/admin'))
app.use('/.well-known/webfinger', cors(), routes.webfinger)
app.use('/u', cors(), routes.user)
app.use('/m', cors(), routes.message)
app.use('/api/inbox', cors(), routes.inbox)

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'))
})
