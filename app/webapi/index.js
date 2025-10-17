const express = require('express');

const app = express();
const PORT = 8080;



app.get('/healthcheck', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

app.listen(PORT, (error) =>{
    if(!error)
        console.log("Server is Successfully Running, and App is listening on port "+ PORT);
    else 
        console.log("Error occurred, server can't start", error);
    }
);