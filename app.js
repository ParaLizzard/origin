//JSshit esversioe
require('dotenv').config()
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require('ejs');
const mongoose = require('mongoose');
const session  = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const GoogleStrategy = require('passport-google-oidc');
const findOrCreate = require('mongoose-findorcreate');


const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(session({
    secret: "Our big secret.",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://127.0.0.1:27017/userDB", {useNewUrlParser:true,
useUnifiedTopology:true});


const userSchema = new mongoose.Schema( {
    email: String,
    password: String,
    googleId: String,
    secret: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);


const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, cb) {
    process.nextTick(function() {
      return cb(null, {
        id: user.id,
        username: user.username,
        picture: user.picture
      });
    });
});
  
passport.deserializeUser(function(user, cb) {
    process.nextTick(function() {
      return cb(null, user);
    });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: 'http://localhost:3000/auth/google/secrets'
  },
  function(issuer, profile, cb) {
    User.findOne({ googleId: profile.id })
        .then(user => {
        if(!user) {
            // Create a new user and save it to the database
            const newUser = new User({
              googleId: profile.id,
              username: profile.displayName
            });
            newUser.save()
            .then(() => cb(null, newUser))
            .catch(err => cb(err));          
          } else {
            // User already exists, log them in
            cb(null, user);
          }
        })
        .catch(err => cb(err));
    }
));


/*passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
    },
    function(accessToken, refreshToken, profile, cb) {
        User.findOrCreate({ googleId: profile.id}, function(err,user) {
            return cb(err,user);
        });
    }
));*/


app.get("/", (req,res)=>{
    res.render("home")
});

app.get('/logout', function(req, res, next){
    req.logout(function(err) {
      if (err) { return next(err); }
      res.redirect('/');
    });
  });

app.get('/login/google', passport.authenticate('google', {
    scope: [ 'email' ]
  }));

app.get("/auth/google", (req,res) => {
    passport.authenticate("google", {scope: ["profile"] });
});

app.get('/auth/google/secrets',
  passport.authenticate('google', { failureRedirect: '/register', failureMessage: true }),
  function(req, res) {
    res.redirect('/secrets');
  });

app.get("/login", function(req,res){
    res.render("login");
})

app.get("/register", (req,res)=>{
    res.render("register");
});

app.get("/secrets", function(req,res){
    User.find({"secret":{$ne:null}})
    .then(foundUser => {
        if(foundUser){
            res.render("secrets", {usersWithSecrets: foundUser});
        }
    })
    .catch(err => {
        console.log(err);
    });
});

app.get("/submit", function(req,res){
    if (req.isAuthenticated()) {
        res.render("submit");
    } else {
        res.redirect("/login");
    }
});

app.post("/submit", (req,res) => {
    const submittedSecret = req.body.secret;

    User.findById(req.user.id)
        .then(foundUser => {
            if(foundUser){
                foundUser.secret = submittedSecret;
                foundUser.save().then(()=>{
                res.redirect("secrets");
                });   
            }
        
        })
        .catch(err => {
            console.log(err);
    });  

});

app.post("/register", function(req, res) {
    User.register({username: req.body.username}, req.body.password, function(err,user){
        if(err){
            console.log(err);
            res.redirect("secrets");
        } else{
            passport.authenticate("local")(req,res, function(){
                res.redirect("secrets");
            });
        }
    });
});

app.post("/login", function(req, res) {
    const user = new User({
        username: req.body.username,
        password: req.body.password
    })

    req.login(user, function(err){
        if(err) {
            console.log(err);
        } else {
            passport.authenticate("local")(req,res, function(){
                res.redirect("/secrets");
            });
        }
    });
        
    
});

app.listen(3000, function() {
    console.log("Server started on port 3000");
});