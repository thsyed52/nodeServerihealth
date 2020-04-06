var crypto = require("crypto");
var mysql = require("mysql");
var uuid = require("uuid");
var bodyParser = require("body-parser");
var express = require("express");
var multipart = require("connect-multiparty");
var fs = require("fs");
var querystring = require("querystring");
const jwt = require("jsonwebtoken");
const { Expo } = require("expo-server-sdk");
var CronJob = require("cron").CronJob;
// var tfidf = require("tfidf");
var job = new CronJob(
  "0 0 9,21 * * *",
  // "0 * * * * *",
  function () {
    push_notification();
  },
  null,
  true,
  "Asia/Karachi"
);

var conn = mysql.createConnection({
  host: "ihealth-aws-v2.cdpwtn8dye9k.us-east-2.rds.amazonaws.com",
  user: "admin",
  password: "admin1234",
  database: "healthappdb",
});
conn.connect(function (err) {
  if (err) throw err;
  console.log("Connected!");
});

var generateRandomString = function (length) {
  return crypto
    .randomBytes(Math.ceil(length / 2))
    .toString("hex")
    .slice(0, length);
};

var sha512 = function (password, salt) {
  var hash = crypto.Hmac("sha512", salt);
  console.log("password = " + password);
  hash.update(password);
  var value = hash.digest("hex");
  return {
    salt: salt,
    passwordHash: value,
  };
};

function saltHashPassword(userPassword) {
  var salt = generateRandomString(16);
  var passwordData = sha512(userPassword, salt);
  return passwordData;
}

function checkHashPassword(userPassword, salt) {
  var data = sha512(userPassword, salt);
  return data.passwordHash;
}

var app = express();
// app.use(bodyParser.json())
// app.use(bodyParser.urlencoded({extended:true}));
// app.use(express.bodyParser({limit: '50mb'}));
app.use(
  bodyParser.urlencoded({
    limit: "5mb",
    parameterLimit: 100000,
    extended: false,
  })
);

app.use(
  bodyParser.json({
    limit: "5mb",
  })
);
app.use(multipart());

app.post("/register/", (req, res, next) => {
  console.log(req.body);

  var user = req.body;
  //var address = user.address;
  //console.log("passssss = ", user.encrypted_password);
  var plainPassword = user.encrypted_password;
  var encryptData = saltHashPassword(plainPassword);
  var salt = encryptData.salt;
  var password = encryptData.passwordHash;
  var name = user.Name;
  console.log("name : xxx  ", user);
  var email = user.email;
  var phoneNumber = user.phoneNumber;
  console.log(name, email, phoneNumber);
  //console.log('address', address.streetNo);

  conn.query(
    `SELECT * from user where email=?`,
    [email],
    (err, result, fields) => {
      conn.on("error", () => {
        console.log("[MySQL error]", err);
      });
      console.log(result);
      if (result && result.length) {
        res.status(422).send({ err: "user Already Exists !!!" });
      } else {
        conn.query(
          "INSERT INTO `user` (`Name`, `Email`, `encrypted_password`, `Salt`,`Phone_Number`) " +
            "VALUES (?,?,?,?,?)",
          [name, email, password, salt, phoneNumber],
          function (err, result) {
            if (err) {
              console.log("[MySQL error]", err);
              res.status(422).send({ err: err.message });
            } else {
              //   console.log("id2", );

              const token = jwt.sign(
                { userId: result.insertId },
                "MY_SECRET_KEY"
              );
              res.send({
                token,
                userId: result.insertId.toString(),
                user: JSON.stringify(result),
              });
            }
          }
        );
      }
    }
  );
});

app.post("/login/", (req, res, next) => {
  var userPassword = req.body.password;
  var email = req.body.email;

  console.log(email, userPassword);
  console.log(conn.state);
  conn.query(
    `SELECT * from user where email=?`,
    [email],
    (err, result, fields) => {
      conn.on("error", () => {
        console.log("[MySQL error]", err);
      });
      if (result && result.length) {
        var salt = result[0].Salt;
        var passwordHash = result[0].Encrypted_Password;
        var convertToPasswordHash = checkHashPassword(userPassword, salt);

        if (convertToPasswordHash === passwordHash) {
          const token = jwt.sign({ userId: result[0].Id }, "MY_SECRET_KEY");
          res.send({
            token,
            userId: result[0].Id.toString(),
            user: JSON.stringify(result[0]),
          });
          //  console.log("id", result[0].Id);
          // res.send(JSON.stringify(result[0]));
        } else {
          res.status(422).send({ err: "Wrong Password" });
        }
      } else {
        res.status(422).send({ err: "User not exist" });
      }
    }
  );
});

app.post("/savecompletebloodcount/", (req, res, next) => {
  console.log(req.body);

  var bpReport = req.body;
  conn.query(
    "INSERT INTO `fastingbloodglucose`(`value`, `date`, `user_id`)" +
      " VALUES (?,NOW(),?)",
    [bpReport.value, bpReport.user_id],
    (err, result, fields) => {
      if (err) {
        res.json("failure");
      } else {
        res.json("successfull");
      }
    }
  );
});

app.post("/savebloodpressure/", (req, res, next) => {
  console.log(req.body);

  var { bpReport } = req.body;
  console.log(bpReport);
  console.log(bpReport.value);
  console.log(bpReport.user_id);
  conn.query(
    "INSERT INTO `bloodpressure`(`value`, `date`, `user_id`)" +
      " VALUES (?,NOW(),?)",
    [bpReport.value, bpReport.user_id],
    (err, result, fields) => {
      if (err) {
        res.json("failure");
      } else {
        res.json("successfull");
      }
    }
  );
});

app.post("/saveheart/", (req, res, next) => {
  console.log(req.body);
  var { heartReport } = req.body;
  conn.query(
    "INSERT INTO `heartrate`(`value`, `date`, `user_id`)" +
      " VALUES (?,NOW(),?)",
    [heartReport.value, heartReport.user_id],
    (err, result, fields) => {
      if (err) {
        res.json("failure");
      } else {
        res.json("successfull");
      }
    }
  );
});

app.post("/saveglucose/", (req, res, next) => {
  console.log(req.body);

  var { diabeticReport } = req.body;
  conn.query(
    "INSERT INTO `randombloodglucose`(`value`, `date`, `user_id`)" +
      " VALUES (?,NOW(),?)",
    [diabeticReport.value, diabeticReport.user_id],
    (err, result, fields) => {
      if (err) {
        res.json("failure");
      } else {
        res.json("successfull");
      }
    }
  );
});

app.post("/savefastinplasamglucose/", (req, res, next) => {
  console.log(req.body);

  var { diabeticReport } = req.body;
  conn.query(
    "INSERT INTO `fastingbloodglucose`(`value`, `date`, `user_id`)" +
      " VALUES (?,NOW(),?)",
    [diabeticReport.value, diabeticReport.user_id],
    (err, result, fields) => {
      if (err) {
        res.json("failure");
      } else {
        res.json("successfull");
      }
    }
  );
});
app.post("/savenotification/", (req, res, next) => {
  //console.log(req.body);

  ("UPDATE `user` SET `notification_token` = ? WHERE `id`=?");
  var { id, token } = req.body;
  conn.query(
    "UPDATE `user` SET `notification_token` = ? WHERE `id`=?",
    // "INSERT INTO `user`(`notification_token`)" + " VALUES (?,?)",
    [token, id],
    (err, result, fields) => {
      if (err) {
        res.json("failure");
      } else {
        res.json("successfull");
      }
    }
  );
});

// updated Upload and view report

app.post("/uploadImageReport", (req, res, next) => {
  const { photo } = req.files;
  const { id, type } = req.body;
  console.log(req.files);
  // console.log(type);
  // console.log(photo);
  // console.log(req.files);
  // console.log(req.body.reportName);
  reportName = type;
  user_id = id;
  // console.log(req.files);
  // console.log(req.files["images"].path);
  var img = fs.readFileSync(photo.path);
  // console.log(typeof img.toString());
  // console.log(img.toString("base64"));

  var report = {
    reportId: "",
    reportName: "",
    reportImage: "",
    reportDate: "",
  };

  conn.query(
    "INSERT INTO `imaget`(`user_id`, `img`, `reportName`, `reportDate`) VALUES (?, ? ,?, NOW())",
    [user_id, img, reportName],
    (err, result) => {
      conn.on("error", () => {
        res.send(JSON.stringify(err));
      });
      conn.query(
        "SELECT * FROM `imaget` ORDER BY reportDate desc LIMIT 1",
        (err, result) => {
          conn.on("error", () => {
            res.send(JSON.stringify(err));
          });

          console.log(typeof result);
          console.log(result[0].reportDate);
          var buffer = Buffer.from(result[0].img, "binary");
          report.reportImage = buffer.toString("base64");
          report.reportName = result[0].reportName;
          report.reportDate = result[0].reportDate;
          report.reportId = result[0].reportId;

          //         console.log(report);
          res.send(JSON.stringify(report));
        }
      );
    }
  );
});

app.get("/getReports", (req, res, next) => {
  var report = {
    reportId: "",
    reportName: "",
    reportImage: "",
    reportDate: "",
  };
  var user_id = querystring.parse(req.url)["/getReports?id"];
  conn.query(
    "select * from `imaget` where user_id = ? ORDER BY reportDate DESC",
    [user_id],
    (err, result, fields) => {
      conn.on("error", () => {
        console.log("[MySQL error]", err);
      });

      //var buffer = Buffer.from(result[0].img,'binary');

      //  console.log(buffer.toString('base64'));
      result.forEach((element) => {
        var buffer = Buffer.from(element.img, "binary");
        element.img = buffer.toString("base64");
        //console.log("in loop");
      });

      if (result.length === 0) {
        res.send("noData");
      } else {
        res.send(JSON.stringify(result));
      }
    }
  );
});

app.get("/getRandomPlasmaGlucose", (req, res, next) => {
  //  var reading = {reportId:'', reportName : '', reportImage: '', reportDate : ''}
  var user_id = querystring.parse(req.url)["/getRandomPlasmaGlucose?id"];
  conn.query(
    "select * from `randombloodglucose` where user_id = ?",
    [user_id],
    (err, result, fields) => {
      conn.on("error", () => {
        console.log("[MySQL error]", err);
      });

      if (result.length === 0) {
        res.send("noData");
      } else {
        res.send(JSON.stringify(result));
      }
    }
  );
});

app.get("/getFastingPlasmaGlucose", (req, res, next) => {
  var user_id = querystring.parse(req.url)["/getFastingPlasmaGlucose?id"];
  conn.query(
    "select * from `fastingbloodglucose` where user_id = ?",
    [user_id],
    (err, result, fields) => {
      conn.on("error", () => {
        console.log("[MySQL error]", err);
      });

      if (result.length === 0) {
        res.send("noData");
      } else {
        res.send(JSON.stringify(result));
      }
    }
  );
});

app.get("/getBloodPressure", (req, res, next) => {
  var user_id = querystring.parse(req.url)["/getBloodPressure?id"];
  //console.log(user_id);
  conn.query(
    "select * from `bloodpressure` where user_id = ?",
    [user_id],
    (err, result, fields) => {
      conn.on("error", () => {
        console.log("[MySQL error]", err);
      });
      console.log("result", result);
      if (result.length === 0) {
        res.send("noData");
      } else {
        res.send(JSON.stringify(result));
      }
    }
  );
});

app.get("/getHeartRate", (req, res, next) => {
  var user_id = querystring.parse(req.url)["/getHeartRate?id"];
  conn.query(
    "select * from `heartrate` where user_id = ?",
    [user_id],
    (err, result, fields) => {
      conn.on("error", () => {
        console.log("[MySQL error]", err);
      });

      if (result.length === 0) {
        res.send("noData");
      } else {
        res.send(JSON.stringify(result));
      }
    }
  );
});

app.get("/getSymptoms", (req, res, next) => {
  //var user_id = querystring.parse(req.url)['/getHeartRate?id'];
  console.log("in get symptoms");
  conn.query("select * from `symptoms` ", (err, result, fields) => {
    conn.on("error", () => {
      console.log("[MySQL error]", err);
    });
    console.log(result);

    if (result.length === 0) {
      res.send("noData");
    } else {
      res.send(JSON.stringify(result));
    }
  });
});
app.get("/getDiseaseSymptoms", (req, res, next) => {
  //var user_id = querystring.parse(req.url)['/getHeartRate?id'];

  conn.query("select * from `disease_symptoms` ", (err, result, fields) => {
    conn.on("error", () => {
      console.log("[MySQL error]", err);
    });
    console.log(result);

    if (result.length === 0) {
      res.send("noData");
    } else {
      res.send(JSON.stringify(result));
    }
  });
});
app.get("/getDiseaseSymptoms2", (req, res, next) => {
  //var user_id = querystring.parse(req.url)['/getHeartRate?id'];
  const desease = [];
  const symp = [];
  conn.query("select * from `disease_symptoms` ", (err, result, fields) => {
    conn.on("error", () => {
      console.log("[MySQL error]", err);
    });
    // console.log(result);
    // result = JSON.stringify(result);
    console.log(result);
    result.forEach((element) => {
      // console.log("elem", element);
      desease.push(element.name);
      symp.push(element.symptoms_list);
    });
    // var data = tfidf.analyze("sdad", [symp[0], symp[1], symp[2]], "");
    res.send(JSON.stringify(symp));
  });
});
app.get("/getPharmacies", (req, res, next) => {
  var city = querystring.parse(req.url)["/getPharmacies?city"];
  // console.log(`select * from pharmacy where city = ?`, [city]);
  conn.query(
    `select * from pharmacy where city = ?`,
    [city],
    (err, result, fields) => {
      conn.on("error", () => {
        console.log("[MySQL error]", err);
      });
      // console.log(result);

      if (result.length === 0) {
        res.send("noData");
      } else {
        res.send(JSON.stringify(result));
      }
    }
  );
});

const push_notification = () => {
  conn.query(
    "SELECT DISTINCT(notification_token) FROM `user` WHERE notification_token is not null",
    (err, result, fields) => {
      conn.on("error", () => {
        console.log("[MySQL error]", err);
      });
      // console.log(result);

      let expo = new Expo();

      // Create the messages that you want to send to clents
      let messages = [];
      let somePushTokens = result.map((item) => {
        return item.notification_token;
      });
      for (let pushToken of somePushTokens) {
        // Each push token looks like ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]

        // Check that all your push tokens appear to be valid Expo push tokens
        if (!Expo.isExpoPushToken(pushToken)) {
          console.error(
            `Push token ${pushToken} is not a valid Expo push token`
          );
          continue;
        }

        // Construct a message (see https://docs.expo.io/versions/latest/guides/push-notifications)
        messages.push({
          to: pushToken,
          sound: "default",
          body: "Kindly enter your daily vital readings",
          priority: "high",
          channelId: "healthApp-messages",
        });
      }

      // The Expo push notification service accepts batches of notifications so
      // that you don't need to send 1000 requests to send 1000 notifications. We
      // recommend you batch your notifications to reduce the number of requests
      // and to compress them (notifications with similar content will get
      // compressed).
      let chunks = expo.chunkPushNotifications(messages);
      let tickets = [];
      (async () => {
        // Send the chunks to the Expo push notification service. There are
        // different strategies you could use. A simple one is to send one chunk at a
        // time, which nicely spreads the load out over time:
        for (let chunk of chunks) {
          try {
            let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
            tickets.push(...ticketChunk);
            // NOTE: If a ticket contains an error code in ticket.details.error, you
            // must handle it appropriately. The error codes are listed in the Expo
            // documentation:
            // https://docs.expo.io/versions/latest/guides/push-notifications#response-format
          } catch (error) {
            console.error(error);
          }
        }
      })();
    }
  );
};

app.listen(3000, "0.0.0.0", () => {
  console.log("listening at port 3000");
});
