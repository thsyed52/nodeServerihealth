var crypto = require('crypto')
var mysql = require('mysql')
var uuid = require('uuid')
var bodyParser = require('body-parser')
var express = require('express')
var multipart = require('connect-multiparty');
var fs = require("fs");
var querystring = require("querystring");

var conn=  mysql.createConnection({
                host:"ihealth.cdpwtn8dye9k.us-east-2.rds.amazonaws.com",
                user:"admin",
                password:"admin1234",
                database:"ihealth"
            })
var generateRandomString = function(length){
    return crypto.randomBytes(Math.ceil(length/2))
                 .toString('hex')
                 .slice(0, length);
}

var sha512 = function(password, salt){
    var hash = crypto.Hmac('sha512',salt);
    console.log("password = " + password);
    hash.update(password);
    var value = hash.digest('hex');
    return{
        salt:salt,
        passwordHash: value
    }
}

function saltHashPassword(userPassword){
    var salt = generateRandomString(16);
    var passwordData = sha512(userPassword,salt);
    return passwordData;
}


function checkHashPassword(userPassword, salt){
    var data  = sha512(userPassword,salt);
    return data.passwordHash;
}


var app = express();
// app.use(bodyParser.json())
// app.use(bodyParser.urlencoded({extended:true}));
// app.use(express.bodyParser({limit: '50mb'}));            
app.use(bodyParser.urlencoded({
    limit: '5mb',
    parameterLimit: 100000,
    extended: false 
}));

app.use(bodyParser.json({
    limit: '5mb'
}));            
app.use(multipart());


app.post("/register/", (req,res,next)=>{

    console.log(req.body);
    
    var user = req.body;
    //var address = user.address;
    console.log("passssss = " , user.encrypted_password);
    var plainPassword = user.encrypted_password;
    var encryptData = saltHashPassword(plainPassword);
    var salt = encryptData.salt;
    var password = encryptData.passwordHash;
    var name = user.Name;
    console.log("name : xxx  "  , user )
    var email = user.email;
    //console.log(name, email);
    //console.log('address', address.streetNo);

    conn.query(`SELECT * from user where email=?`,[email],(err, result, fields)=>{
        conn.on('error',()=>{
            console.log("[MySQL error]", err);
        });
        console.log(result);
        if(result && result.length)
        {
            res.json("user Already Exists !!!");
        }
        else
        {
            conn.query('INSERT INTO `user` (`Name`, `Email`, `encrypted_password`, `Salt`) '+
                        'VALUES (?,?,?,?)',[name,email,password,salt],function(err, result){
                            if(err){
                                console.log("[MySQL error]", err);
            
                                res.json("Register error : ", err);
                            }
                        });
        }

    });

    
});

app.post("/login/", (req,res,next)=>{
    var userPassword = req.body.password;
    var email = req.body.email;

    console.log(email, userPassword);

    conn.query(`SELECT * from user where email=?`,[email],(err, result, fields)=>{
        conn.on('error',()=>{
            console.log("[MySQL error]", err);
        });
        console.log(result);
        if(result && result.length)
        {
            var salt = result[0].Salt;
            var passwordHash = result[0].Encrypted_Password;
            var convertToPasswordHash  = checkHashPassword(userPassword, salt);

            if(convertToPasswordHash === passwordHash)
            {
                res.send(JSON.stringify(result[0]));
            }
            else{
                res.json("Wrong Password");
            }
        }
        else
        {
            res.json("User not exist");
        }

    });


}); 

app.post("/savecompletebloodcount/", (req,res,next)=>{
    console.log(req.body);
    
    var bpReport = req.body;
    conn.query('INSERT INTO `fastingbloodglucose`(`value`, `date`, `user_id`)'+
                ' VALUES (?,NOW(),?)',[bpReport.value,bpReport.user_id],(err, result, fields)=>{
            if(err)
            {
                res.json("failure");
            }
            else{
                res.json("successfull");
            }
        });
});

app.post("/savebloodpressure/", (req,res,next)=>{
    console.log(req.body);
    
    var bpReport = req.body;
    conn.query('INSERT INTO `bloodpressure`(`value`, `date`, `user_id`)'+
                ' VALUES (?,NOW(),?)',[bpReport.value,bpReport.user_id],(err, result, fields)=>{
            if(err)
            {
                res.json("failure");
            }
            else{
                res.json("successfull");
            }
        });
});

app.post("/saveheart/", (req,res,next)=>{
    console.log(req.body);
    var heartReport = req.body;
    conn.query('INSERT INTO `heartrate`(`value`, `date`, `user_id`)'+
                ' VALUES (?,NOW(),?)',[heartReport.value,heartReport.user_id],(err, result, fields)=>{
            if(err)
            {
                res.json("failure");
            }
            else{
                res.json("successfull");
            }
        });
        
});

app.post("/saveglucose/", (req,res,next)=>{
    console.log(req.body);

   var diabeticReport = req.body;
    conn.query('INSERT INTO `randombloodglucose`(`value`, `date`, `user_id`)'+
                ' VALUES (?,NOW(),?)',[diabeticReport.value,diabeticReport.user_id],(err, result, fields)=>{
            if(err)
            {
                res.json("failure");
            }
            else{
                res.json("successfull");
            }
        });
        
}); 


app.post("/savefastinplasamglucose/", (req,res,next)=>{
    console.log(req.body);

   var diabeticReport = req.body;
    conn.query('INSERT INTO `fastingbloodglucose`(`value`, `date`, `user_id`)'+
                ' VALUES (?,NOW(),?)',[diabeticReport.value,diabeticReport.user_id],(err, result, fields)=>{
            if(err)
            {
                res.json("failure");
            }
            else{
                res.json("successfull");
            }
        });
        
}); 


// updated Upload and view report

app.post("/uploadImageReport",  (req,res,next)=>{
    //console.log(req);
    console.log(req.body.reportName)
    reportName = req.body.reportName
    user_id = req.body.id;
    console.log(req.files)
    console.log(req.files['images'].path);
    var img = fs.readFileSync(req.files['images'].path);
    console.log(typeof img.toString())
  //  console.log(img.toString('base64'))   

    var report = {reportId:'', reportName : '', reportImage: '', reportDate : ''}


    conn.query('INSERT INTO `imaget`(`user_id`, `img`, `reportName`, `reportDate`) VALUES (?, ? ,?, NOW())',
                [user_id, img, reportName],(err, result)=>{
        conn.on('error',()=>{
            res.send(JSON.stringify(err));
        });
        conn.query('SELECT * FROM `imaget` ORDER BY reportDate desc LIMIT 1',(err, result)=>{
            conn.on('error',()=>{
                res.send(JSON.stringify(err));
            });

            console.log(typeof result);
            console.log(result[0].reportDate)
            var buffer = Buffer.from(result[0].img,'binary');
            report.reportImage = buffer.toString('base64');
            report.reportName = result[0].reportName;
            report.reportDate = result[0].reportDate;
            report.reportId =  result[0].reportId;

   //         console.log(report);
            res.send(JSON.stringify(report));
        });
    });

});

app.get('/getReports', (req,res,next)=>{

    var report = {reportId:'', reportName : '', reportImage: '', reportDate : ''}
    var user_id = querystring.parse(req.url)['/getReports?id'];
    conn.query('select * from `imaget` where user_id = ?',[user_id],(err, result, fields)=>{
        conn.on('error',()=>{
            console.log("[MySQL error]", err);
        });

        //var buffer = Buffer.from(result[0].img,'binary');

      //  console.log(buffer.toString('base64'));
        console.log("here1")
        result.forEach(element => {
            var buffer = Buffer.from(element.img,'binary');
            element.img = buffer.toString('base64');
            console.log('in loop');
        });

        console.log("here2")
        res.send(JSON.stringify(result))
        });
});


app.get('/getRandomPlasmaGlucose', (req,res,next)=>{

//  var reading = {reportId:'', reportName : '', reportImage: '', reportDate : ''}
    var user_id = querystring.parse(req.url)['/getRandomPlasmaGlucose?id'];
    conn.query('select * from `randombloodglucose` where user_id = ?',[user_id],(err, result, fields)=>{
    conn.on('error',()=>{
        console.log("[MySQL error]", err);
    });

    res.send(JSON.stringify(result))
    
    });
});



app.get('/getFastingPlasmaGlucose' ,(req , res , next )=>{

    var user_id = querystring.parse(req.url)['/getFastingPlasmaGlucose?id'];
    conn.query('select * from `fastingbloodglucose` where user_id = ?',[user_id],(err, result, fields)=>{
    conn.on('error',()=>{
        console.log("[MySQL error]", err);
    });

    res.send(JSON.stringify(result))
    
    });


});

app.get('/getBloodPressure' ,(req , res , next )=>{

    var user_id = querystring.parse(req.url)['/getBloodPressure?id'];
    conn.query('select * from `bloodpressure` where user_id = ?',[user_id],(err, result, fields)=>{
    conn.on('error',()=>{
        console.log("[MySQL error]", err);
    });

    res.send(JSON.stringify(result))
    
    });
});

app.get('/getHeartRate' ,(req , res , next )=>{

    var user_id = querystring.parse(req.url)['/getHeartRate?id'];
    conn.query('select * from `heartrate` where user_id = ?',[user_id],(err, result, fields)=>{
    conn.on('error',()=>{
        console.log("[MySQL error]", err);
    });

    res.send(JSON.stringify(result))
    
    });
});

    

app.listen(3000,'192.168.8.103',()=>{
    console.log("listening at port 3000");
})