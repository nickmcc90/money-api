const express = require("express")
const app = express()
PORT = 3005
require('dotenv').config()

//Variables
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
const stripe = require('stripe')(STRIPE_SECRET_KEY)
const DOMAIN = "http://localhost:3005"


app.use(express.json())

// middle ware
app.use(express.static('public'))


//routes
app.post('/create-checkout-session/:product', (req, res) => {
  const { product } = req.params
  let mode, price_ID, line_items

  if (product === 'sub') {
    price_ID = ''
    mode = 'subscription'
    line_items = [
      {
        price: price_ID
      }
    ]
  } else if (product === 'pre') {
    price_ID = ''
    mode = 'payment'
    line_items = [
      {
        price: price_ID,
        quantity: 1
      }
    ]
  } else {
    return res.sendStatus(403)
  }
})


app.listen(PORT, () => console.log("Listening to port :", PORT))