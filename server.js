const express = require("express")
const app = express()
PORT = 3005

app.use(express.json())

// middle ware
app.use(express.static('public'))


//routes


app.listen(PORT, () => console.log("Listening to port :", PORT))