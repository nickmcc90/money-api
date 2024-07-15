const express = require("express")
const { generateApiKey } = require("generate-api-key")
const app = express()
PORT = 3005
require('dotenv').config()
const { db } = require('./firebase')

//Variables
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
const stripe = require('stripe')(STRIPE_SECRET_KEY)
const DOMAIN = "http://localhost:3005"


app.use(express.json())

// middle ware
app.use(express.static('public'))


//routes
app.get('/api', async (req, res) => {
  const { api_key } = req.query
  if(!api_key) return res.sendStatus(403)
  let paid_status, type
  const doc = await db.collection('api-keys').doc(api_key).get()
  if(!doc.exists) {
    return res.status(403).json({'status': 'API key is invalid'})
  } else {
    const { status, customer_id } = doc.data()

    if(status === 'subscription') {
      //subscription
      paid_status = true
      //stripe updating
      const customer = await stripe.customers.retrieve(
        customer_id,
        { expand: ['subscriptions']}
      )
      let subscriptionId = customer?.subscriptions?.data?.[0]?.id
      const subscription = await stripe.subscriptions.retrieve(subscriptionId)
      const itemId = subscription?.items?.data[0].id

      const record = stripe.subscriptionItems.createUsageRecord(
        itemId, {
          quantity: 1,
          timestamp: 'now',
          action: 'increment'
        }
      )
      console.log('record created')

    } else if (status > 0) {
      //prepaid
      paid_status = true
      //firebase updating
      const data = { 
        status: status - 1
      }
      await db.collection('api-keys').doc(api_key).set(data, { merge: true })
    }

  }

  if(paid_status) {
    res.status(200).json({"message": "You can do it, I believe in you!"})
  } else {
    res.sendStatus(403)
  }

})

app.get('/check-status', async (req, res) => {
  const { api_key } = req.query
  const doc = await db.collection('api-keys').doc(api_key).get()
  if(!doc.exists) {
    res.status(400).json({"status": "API key does not exist."})
  } else {
    const { status } = doc.data()
    res.status(200).json({"status": status})
  }
})


app.post('/create-checkout-session/:product', async (req, res) => {

  const { product } = req.params
  let mode, price_ID, line_items

  if (product === 'sub') {
    price_ID = 'price_1PceP8J5ttDMx8MuO1tiKnCW'
    mode = 'subscription'
    line_items = [
      {
        price: price_ID
      }
    ],
    quantity_type = "subscription"
  } else if (product === 'pre') {
    price_ID = 'price_1PceNIJ5ttDMx8MujJvt9Iek'
    mode = 'payment'
    line_items = [
      {
        price: price_ID,
        quantity: 1
      }
    ],
    quantity_type = 10
  } else {
    return res.sendStatus(403)
  }

  const newAPIKey = generateApiKey()
  const customer = await stripe.customers.create({
    metadata: {
      APIkey: newAPIKey
    }
  })

  const stripeCustomerId = customer.id
  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    metadata: {
      APIkey: newAPIKey,
      payment_type: product
    },
    line_items: line_items,
    mode: mode,
    success_url: `${DOMAIN}/success.html?api_key=${newAPIKey}`,
    cancel_url: `${DOMAIN}/cancel.html`
  })

  //create firebase record
  const data = {
      APIkey: newAPIKey,
      payment_type: product,
      customer_id: stripeCustomerId,
      status: quantity_type
  }
  const dbRes = await db.collection('api-keys').doc(newAPIKey).set(data, { merge: true })

  //use a webhook to access the firebase entry for the api key and update
  //billing information

  res.redirect(303, session.url)
})

app.get('/delete', async (req, res) => {
  const { api_key } = req.query
  const doc = await db.collection('api-keys').doc(api_key).get()
  if(!doc.exists) {
    res.status(400).json({"status": "API key does not exist."})
  } else {
    const { customer_id } = doc.data()
    try {
      const customer = await stripe.customers.retrieve(
        customer_id,
        { expand: ['subscriptions']}
      )
      let subscriptionId = customer?.subscriptions?.data?.[0]?.id
      await stripe.subscriptions.cancel(subscriptionId)

      res.status(200).json({"status": "deleted"})

      //firebase updating

      const data = {
        status: null
      }

      await db.collection('api-keys').doc(api_key).set(data, { merge: true })

    } catch (err) {
      console.log(err)
    }


    res.sendStatus(200)
  }


})


app.listen(PORT, () => console.log("Listening to port :", PORT))