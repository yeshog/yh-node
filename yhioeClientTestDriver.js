var c = require("./yhioeClient.js")

c.testYhioeEndpoint('127.0.0.1', 4433, '/n/g',{
    email: 'test@domain.com',
    user: 'testusername',
    password: 'testpassword'
});
