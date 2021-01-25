
const crypto = require('crypto')
const Cloudant = require('@cloudant/cloudant')
const url = require('url')
const axios = require('axios').default
let cloudant
let db

// calculate sha1 hash of incoming object
const calculateHash = (str, secret) => {
  const hmac = crypto.createHmac('sha1', secret).update(str).digest('hex')
  return 'sha1=' + hmac
}

const fetchContent = async (fullName, branch, path) => {
  const rawURL = `https://raw.githubusercontent.com/${fullName}/${branch}/${path}`
  console.log('url', url)
  const response = await axios.get(rawURL)
  if (typeof response.data === 'object') {
    return response.data
  } else {
    return {}
  }
}

const main = async (params) => {
  let i
  let j

  // set up Cloudant connection
  if (!cloudant) {
    cloudant = Cloudant(params.COUCH_URL)
    db = cloudant.db.use('github')
  }

  // get raw body
  const body = params.__ow_body

  // base64 decode it
  const bodyStr = Buffer.from(body, 'base64').toString()

  // parse it
  const parsed = JSON.parse(bodyStr)

  const incomingHash = params.__ow_headers['x-hub-signature']
  const calculatedHash = calculateHash(bodyStr, params.GITHUB_SECRET)
  console.log('hashes', incomingHash, calculatedHash)

  // only interested in matching hashes on  the main branch
  if (incomingHash === calculatedHash && parsed.ref === 'refs/heads/main') {
    // extract repo name
    const repoName = parsed.repository.full_name

    // create list of documents to change

    console.log('commits', parsed.commits)
    for (i in parsed.commits) {
      let upserts = new Set()
      let deletes = new Set()
      const commit = parsed.commits[i]
      for (j in commit.added) {
        upserts.add(commit.added[j])
      }
      for (j in commit.modified) {
        upserts.add(commit.modified[j])
      }
      for (j in commit.removed) {
        deletes.add(commit.removed[j])
      }
      // console.log('added/modified/removed', commit.added, commit.modified, commit.removed)

      // we only want to deal with files that end in .json
      upserts = Array.from(upserts).filter((f) => { return f.endsWith('.json') })
      deletes = Array.from(deletes).filter((f) => { return f.endsWith('.json') })

      // fetch the last revision ids for each document
      const response = await db.fetchRevs({ keys: upserts.concat(deletes).map((s) => { return s.replace(/\.json$/, '') }) })
      const revLookup = {}
      for (j in response.rows) {
        const row = response.rows[j]
        if (row.id) {
          revLookup[row.key] = row.value.rev
        } else {
          revLookup[row.key] = null
        }
      }
      console.log('upserts', upserts, 'deletes', deletes, 'revLookup', revLookup)

      // assemble a bulk write to Cloudant - upserts first
      const bulkRequest = { docs: [] }
      for (j in upserts) {
        const upsert = upserts[j]
        const doc = await fetchContent(repoName, commit.id, upsert)
        doc._id = upsert.replace(/\.json$/, '')
        if (revLookup[doc._id]) {
          doc._rev = revLookup[doc._id]
        }
        bulkRequest.docs.push(doc)
      }

      // then the deletes
      for (j in deletes) {
        const del = deletes[j]
        const doc = {}
        doc._id = del.replace(/\.json$/, '')
        if (revLookup[doc._id]) {
          doc._rev = revLookup[doc._id]
          doc._deleted = true
          bulkRequest.docs.push(doc)
        }
      }
      console.log('bulkRequest', bulkRequest)

      // if we have docs to write, write 'em
      if (bulkRequest.docs.length > 0) {
        const response = await db.bulk(bulkRequest)
        console.log(response)
      }
    }

    return { message: 'Hello World' }
  } else {
    console.log('not interested')
  }
}

exports.main = main
