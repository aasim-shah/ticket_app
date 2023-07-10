require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const ejs = require('ejs');
const { default: mongoose } = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const multer = require('multer');
const moment = require('moment')
const path = require('path');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const stripe = require('stripe')(process.env.STRIPESECRETKEY);
const cors = require('cors');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;


const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json()); // for parsing application/json

app.use(session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false
}));
app.use(cors())
app.use(passport.initialize());
app.use(passport.session());

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './public/uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

const transporter = nodemailer.createTransport({
    service: process.env.SERVICE,
    auth: {
        user: process.env.USER,
        pass: process.env.PASS
    }
});

async function sendOrderConfirmationEmail(customerEmail, emailText, emailSubject) {
    const mailOptions = {
        from: process.env.MYMAIL,
        to: customerEmail,
        subject: emailSubject,
        text: emailText
    };

    await transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
            console.error(error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });
}


main().catch(err => console.log(err));

async function main() {
    await mongoose.connect(process.env.MONG);
    const idSchema = new mongoose.Schema({
        name: String,
        userId: Number,
        eventId: Number,
        ticketId: Number
    });
    const userSchema = new mongoose.Schema({
        _id: Number,
        username: String,
        name: String,
        password: String,
        email: String,
        phone: Number,
        photo: String,
        accountBalance: { type: Number, default: 0 },
        resetPasswordToken: String,
        isAdmin: Boolean,
        resetPasswordExpires: Number,
        verificationtToken: String,
        verified: Boolean
    });
    const eventSchema = new mongoose.Schema({
        _id: Number,
        eventName: String,
        startdate: Date,
        enddate: Date,
        eventEnd: Boolean,
        winnerId: Number,
        userIds: [{
            type: Number
        }],
        ticketValue: [{
            type: Number
        }]
    });
    const ticketSchema = new mongoose.Schema({
        _id: Number,
        userId: Number,
        eventId: Number,
        value: Number,
        bought: Boolean
    });
    const notificationSchema = new mongoose.Schema({
        userId: Number,
        notification: String
    }, { timestamps: true });

    userSchema.plugin(passportLocalMongoose);

    const Id = mongoose.model('Id', idSchema);
    const User = mongoose.model('User', userSchema);
    const Event = mongoose.model('Event', eventSchema);
    const Ticket = mongoose.model('Ticket', ticketSchema);
    const Notification = mongoose.model('Notification', notificationSchema);

    passport.use(User.createStrategy());

    passport.use(new GoogleStrategy({
        clientID: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        callbackURL: "https://ticket-app-zxnm.onrender.com/auth/google/callback",
        userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
      },
      async function(accessToken, refreshToken, profile, cb) {
            const user = await  User.findOne({_id: Number(profile.id)}); 
            console.log({profile})
            if (!user) {
                user = new User({
                    _id: Number(profile.id),
                    username: profile.emails[0].value,
                    name: profile.displayName,
                    password: "",
                    // email: profile.emails[0].value,
                    phone: 9999999999,
                    // photo: profile.photos[0].value,
                    accountBalance: 0,
                    resetPasswordToken: '1',
                    resetPasswordExpires: 1,
                    verificationtoken: '1',
                    verified: true
                });
                await user.save();
                req.login(user, function(err){
                    if(err){
                        console.log(err);
                    }else{
                        return done(err, user);
                    }
                });
            }else{
                req.login(user, function(err){
                    if(err){
                        console.log(err);
                    }else{
                        return done(err, user);
                    }
                });
            }
        }
    ));


    passport.use(
        new FacebookStrategy(
          {
            clientID: process.env.FACEBOOK_APP_ID,
            clientSecret: process.env.FACEBOOK_APP_SECRET,
            callbackURL: '/auth/facebook/callback',
            profileFields: ['id', 'displayName', 'email', 'photos'],
          },
          async function(accessToken, refreshToken, profile, cb) {
            const user = await  User.findOne({_id: Number(profile.id)}); 
            if (!user) {
                user = new User({
                    _id: Number(profile.id),
                    username: profile.emails[0].value,
                    name: profile.displayName,
                    password: "",
                    email: profile.emails[0].value,
                    phone: 9999999999,
                    photo: profile.photos[0].value,
                    accountBalance: 0,
                    resetPasswordToken: '1',
                    resetPasswordExpires: 1,
                    verificationtoken: '1',
                    verified: true
                });
                await user.save();
                req.login(user, function(err){
                    if(err){
                        console.log(err);
                    }else{
                        return done(err, user);
                    }
                });
            }else{
                req.login(user, function(err){
                    if(err){
                        console.log(err);
                    }else{
                        return done(err, user);
                    }
                });
            }
        }
        )
      );
    


    passport.serializeUser(User.serializeUser());
    passport.deserializeUser(User.deserializeUser());
    passport.serializeUser(function(user, cb) {
        process.nextTick(function() {
          return cb(null, user._id);
        });
      });
      
      passport.deserializeUser(function(user, cb) {
        process.nextTick(function() {
          return cb(null, user);
        });
      })
    


    app.get('/', async function (req, res) {
        res.render('Homepage', { auth: req.isAuthenticated() });
    });

    app.get('/register', function (req, res) {
        res.render('Signup', { message: "" });
    });


    app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile' ,"email"] }));
  
  app.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/login' }),
    function(req, res) {
      res.redirect('/');
  });
  
  app.get('/auth/facebook', passport.authenticate('facebook', { scope: ['email', 'user_photos'] }));
  
  app.get(
    '/auth/facebook/callback',
    passport.authenticate('facebook', { failureRedirect: '/login' }),
    (req, res) => {
      res.redirect('/dashboard');
    }
  );


    app.get('/setup_server', async function (req, res) {
        const id = new Id({
            name: 'ids',
            userId: 100,
            eventId: 101,
            ticketId: 102
        })
        await id.save()
        res.redirect("/")
    });


    app.get('/login', function (req, res) {
        res.render('Login', { message: "" });
    });

    app.get('/loginFail', function (req, res) {
        req.logout(function (err) {
            if (err) {
                console.log(err);
            }
        });
        res.render('Login', { message: "Username and password does not match!" });
    });

    app.get('/logout', function (req, res) {
        req.logout(function (err) {
            if (err) {
                console.log(err);
            }
        });
        res.redirect('/');
    });

    app.get('/verify/:token', async function (req, res) {
        const token = req.params.token;
        const email = req.query.email;
        const user = await User.findOne({ email: email });
        if (!user) {
            res.send('<h1>Invalid User!</h1>');
        } else if (user.verificationtToken === token) {
            await User.updateOne({ email: email }, { verificationtToken: '0', verified: true });
            const customerEmail = email;
            const emailText = `Your email has been verified!\n\nWith regards,\nMyple team`;
            const emailSubject = `Email Verified`;
            sendOrderConfirmationEmail(customerEmail, emailText, emailSubject);
            const notification = new Notification({
                userId: Number(user._id),
                notification: "You email has been verified!"
            });
            await notification.save();
            res.render('emailVerified');
        } else {
            res.send('<h1>Invalid Token!</h1>');
        }
    });

    app.get('/resendEmailVerify/:email', async function (req, res) {
        const verificationtToken = crypto.randomBytes(32).toString('hex');
        const email = req.params.email;
        await User.updateOne({ email: email }, { verificationtToken: verificationtToken });
        const verificationLink = `${req.protocol}://${req.headers.host}/verify/${verificationtToken}?email=${email}`;
        const customerEmail = email;
        const emailSubject = `Resent Verification Mail`;
        const emailText = `Dear ${req.body.name},\nPlease follow the link to verify your email: ${verificationLink}\n\nWith regards,\nGreat Escape team`;
        sendOrderConfirmationEmail(customerEmail, emailText, emailSubject);
        res.render('verificationMailSent');
    });

    // Forgot Password route
    app.get('/forgot-password', function (req, res) {
        res.render('ResetPassword', { message: "", step: 1 });
    });

    app.get('/reset-password', async function (req, res) {
        const token = req.query.token;
        if (token) {
            const id = Number(req.query.id);
            console.log({ id })
            const user = await User.findOne({ _id: id });
            if (!user) {
                res.render('ResetPassword', { message: 'Invalid Token!', step: 1 });
            }
            else if (Number(user.resetPasswordExpires) < Date.now()) {
                res.render('ResetPassword', { message: 'Token has expired', step: 1 });
            } else {
                res.render('ResetPassword', { email: user.email, token: token, message: "", step: 3 });
            }
        } else {
            res.redirect("/login")
        }
    });

    app.get('/profile', async function (req, res) {
        if (req.isAuthenticated()) {
            res.render('Profile', { user: req.user });
        } else {
            res.redirect("/login")
        }
    });

    app.get('/currentEvents', async function (req, res) {
        if (req.isAuthenticated()) {
            const events = await Event.find({ eventEnd: false });
            console.log({ events })
            res.render('Upcoming', { events: events, moment });

        } else {
            res.redirect("/login")
        }
    });

    app.get('/pastEvents', async function (req, res) {
        if (req.isAuthenticated()) {
            const events = await Event.find({ eventEnd: true });
            res.render('pastEvents', { events: events, user: req.user });

        } else {
            res.redirect("/login")
        }
    });

    app.get('/addToCart/:eventid/:ticketvalue', async function (req, res) {
        console.log(req.params)
        if (req.isAuthenticated()) {
            const ids = await Id.findOne({ name: 'ids' });
            const ticket = new Ticket({
                _id: Number(ids.ticketId),
                userId: Number(req.user._id),
                eventId: Number(req.params.eventid),
                value: Number(req.params.ticketvalue),
                bought: false
            });
            await ticket.save();
            ids.ticketId = Number(ids.ticketId) + 3;
            await ids.save();
            res.redirect('/cart');
        } else {
            res.redirect('/login');
        }
    });


    app.get('/cart', async function (req, res) {
        if (req.isAuthenticated()) {
            const tickets = await Ticket.find({ userId: Number(req.user._id), bought: false });
            res.render('cart', { tickets: tickets, user: req.user });

        } else {
            res.redirect('/login');
        }
    });

    app.get('/deleteTicket/:ticketid', async function (req, res) {
        if (req.isAuthenticated() && req.user.isAdmin) {

            await Ticket.deleteOne({ _id: Number(req.params.ticketid) });
            res.redirect('/cart');
        } else {
            res.redirect("/admin")
        }
    });
    app.get('/deleteEvent/:eventId', async function (req, res) {
        if (req.isAuthenticated() && req.user.isAdmin) {
            await Event.deleteOne({ _id: Number(req.params.eventId) });
            res.redirect('/adminHome');
        } else {
            res.redirect("/admin")
        }
    });
    app.get('/deleteUser/:userId', async function (req, res) {
        if (req.isAuthenticated() && req.user.isAdmin) {
            await User.deleteOne({ _id: Number(req.params.userId) });
            res.redirect('/adminHome');
        } else {
            res.redirect("/admin")
        }
    });


    app.get('/event/:eventId', async function (req, res) {
        // if(req.isAuthenticated()){
        const eventDetails = await Event.findOne({ _id: Number(req.params.eventId) });
        const tickets = await Ticket.find({ eventId: req.params.eventId });
        const array1 = Array.from({ length: 25 }, (_, i) => i + 1); // [1, 2, 3, ..., 25]

        console.log({ array1 })
        // res.render('/EventDetails', {eventDetails: eventDetails, tickets: tickets, user: req.user});
        console.log({ tickets })
        res.render('EnterEvent', { eventDetails: eventDetails, tickets: tickets, array1 });

        // }
    });

    app.get('/eventDraw/:eventId', async function (req, res) {
        // if(req.isAuthenticated()){
        const eventDetails = await Event.findOne({ _id: Number(req.params.eventId) });
        // res.render('/EventDetails', {eventDetails: eventDetails, user: req.user});
        res.render('EventDetails', { eventDetails: eventDetails });

        // }
    });

    app.get('/settings', async function (req, res) {
        if (req.isAuthenticated()) {
            res.render('/settings', { user: req.user });

        }
    });

    app.get('/notifications', async function (req, res) {
        if (req.isAuthenticated()) {
            const notifications = await Notification.find({ userId: Number(req.user._id) });
            res.render('notifications', { user: req.user, notifications: notifications, moment });
        } else {
            res.redirect("/login")
        }
    });

    app.get('/balance', async function (req, res) {
        if (req.isAuthenticated()) {
            res.render('balance', { user: req.user });

        }
    });

    app.get('/admin', function (req, res) {
        res.render('adminLogin', { message: "" });
    });

    app.get('/adminLoginFail', function (req, res) {
        req.logout(function (err) {
            if (err) {
                console.log(err);
            }
        });
        res.render('adminLogin', { message: "Username and password does not match!" });
    });

    app.get('/adminLogout', function (req, res) {
        req.logout(function (err) {
            if (err) {
                console.log(err);
            }
        });
        res.redirect('/');



    });

    app.get('/adminHome', async function (req, res) {
        console.log(req.user)
        if (req.isAuthenticated() && req.user.isAdmin) {
            const events = await Event.find();
            const users = await User.find();
            const tickets = await Ticket.find();
            res.render('adminHome', { events: events, users: users, tickets: tickets, moment });
        } else {
            res.redirect('/');
        }
    });

    app.get('/addEvent', async function (req, res) {
        // if(req.isAuthenticated()){
        res.render('addEvent');

        // }
    });

    app.get('/endEvent/:eventId', async function (req, res) {
        if (req.isAuthenticated()) {
            const event = await Event.findOne({ _id: Number(req.params.eventId) });
            const w = Math.random() * (event.userIds.length);
            const fixedW = Math.ceil(w);
            console.log({ fixedW })
            console.log({ users: event.userIds })
            console.log({ winnerValue: event.ticketValue[fixedW] })
            console.log({ users1: event.userIds[1] })
            console.log('winneris' + event.userIds[fixedW])
            const winnerId = Math.ceil(event.userIds[fixedW]);
            const winnerValue = Number(event.ticketValue[fixedW]);
            await Event.updateOne({ _id: Number(req.params.eventId) }, { eventEnd: true, winnerId: winnerId });
            const winner = await User.findOne({ _id: winnerId })
            winner.accountBalance = Number(winner.accountBalance) + winnerValue;
            await winner.save();
            let outputArray = Array.from(new Set(event.userIds));
            for (let i = 0; i < outputArray.length; i++) {
                if (Number(outputArray[i]) === winnerId) {
                    const notification = new Notification({
                        userId: Number(winnerId),
                        notification: `Event ${event.name} has ended. You have won ${winnerValue} balance!`
                    });
                    await notification.save();
                    const customerEmail = winner.email;
                    const emailSubject = `Winner of ${event.name}`;
                    const emailText = `Dear ${req.body.name},\nYou have won the event and have been awarded a balance of ${winnerValue}\n\nWith regards,\nGreat Escape team`;
                    sendOrderConfirmationEmail(customerEmail, emailText, emailSubject);
                } else {
                    const notification = new Notification({
                        userId: Number(outputArray[i]),
                        notification: `Event ${event.name} has ended. You have not won the event!`
                    });
                    await notification.save();
                }
            }
            await Ticket.deleteMany({ eventId: Number(req.params.eventId), bought: false });
            res.redirect('/adminHome');

        } else {
            res.redirect('/admin');
        }
    });




































    app.post('/register', upload.single('image'), async function (req, res) {
        console.log(req.body)
        let temp = await Id.findOne({ name: "ids" });

        const verificationtTokenn = await crypto.randomBytes(32).toString('hex');
        User.register({ username: req.body.email, _id: Number(temp.userId), name: req.body.firstName + " " + req.body.lastName, photo: req.file.filename, phone: Number(req.body.phone), email: req.body.email, accountbalance: 0, resetPasswordToken: 1, resetPasswordExpires: '1', verificationtToken: verificationtTokenn, verified: false }, req.body.password, async function (err, user) {
            console.log({ user })
            if (err) {
                console.log({ err })
                res.render('Signup', { message: "Email already exists!" });
            } else {
                await Id.updateOne({ name: "ids" }, { userId: Number(temp.userId) + 4 });
                const verificationLink = `${req.protocol}://${req.headers.host}/verify/${verificationtTokenn}?email=${req.body.email}`;
                const customerEmail = req.body.email;
                const emailSubject = `User Registered`;
                const emailText = `Dear ${req.body.name},\nYou have successfully registered on Great Escape.\nPlease follow the link to verify your email: ${verificationLink}\n\nWith regards,\nGreat Escape team`;
                sendOrderConfirmationEmail(customerEmail, emailText, emailSubject);
                res.render('Login' , {message : "Your Account has been created succesuly !"})
            }
        });
    });

    app.post('/login', async function (req, res) {
        const temp = await User.findOne({ username: req.body.username });
        const user = new User({
            username: req.body.username,
            password: req.body.password
        });
        if (temp) {
            if (temp.verified) {
                req.login(user, function (err) {
                    if (err) {
                        console.log(err);
                    } else {
                        passport.authenticate('local', { failureRedirect: '/loginFail' })(req, res, function () {
                            if (req.user.isAdmin) {
                                res.redirect('/adminHome');
                            } else {
                                res.redirect('/');
                            }
                        });
                    }
                });
            } else {
                res.render('emailUnverified', { email: req.body.username });
            }
        } else {
            res.redirect('/loginFail');
        }
    });

    app.post('/update', upload.single('image'), async function (req, res) {
        await User.updateOne({ _id: req.user._id }, { name: req.body.name, phone: Number(req.body.phone), photo: req.file.filename });
        const notification = new Notification({
            userId: Number(req.user._id),
            notification: `Your details has been updated!`
        });
        await notification.save();
        const customerEmail = req.user.email;
        const emailSubject = `Account Details Updated`;
        const emailText = `Dear ${req.user.name}\nYour account details have been updated.\nIf not done by you, please contact with our customer support.\n\nWith regards,\nGreat Escape team`;
        sendOrderConfirmationEmail(customerEmail, emailText, emailSubject);
        res.redirect('/');
    });

    // Handle password recovery request
    app.post('/forgot-password', async function (req, res) {
        const email = req.body.email;
        const user = await User.findOne({ email: email });
        if (!user) {
            res.render('ResetPassword', { message: 'User not found!', step: 1 });
        }
        const token = crypto.randomBytes(20).toString('hex');
        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000;
        await user.save();
        const customerEmail = email;
        const emailSubject = `Reset password`;
        const resetUrl = `${req.protocol}://${req.headers.host}/reset-password?token=${token}&id=${user._id}`;
        const emailText = `Please click the link to reset the password:\n${resetUrl}`;
        sendOrderConfirmationEmail(customerEmail, emailText, emailSubject);
        res.render('ResetPassword', { message: 'Email sent with instructions!', step: 0 });
    });

    app.post('/reset-password', async (req, res) => {
        const email = req.body.email;
        const password = req.body.password;
        const user = await User.findOne({ email: email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid token' });
        }
        if (user.resetPasswordExpires < Date.now()) {
            return res.status(400).json({ message: 'Token has expired' });
        }
        await user.setPassword(password);
        user.resetPasswordToken = 1;
        user.resetPasswordExpires = '1';
        await user.save();
        const customerEmail = email;
        const emailSubject = `Reset password`;
        const emailText = `Your password has been reset.\nIf not done by you, contact our support as soon as possible.\n\nWith regards,\nMyple team`;
        sendOrderConfirmationEmail(customerEmail, emailText, emailSubject);
        const notification = new Notification({
            userId: Number(user._id),
            notification: `Your password has been successfully reset!`
        });
        await notification.save();
        res.render('login', { message: 'Password reset successful!' });
    });

    app.get('/buyTickets', async function (req, res) {
        if(req.isAuthenticated()){
            res.render('payment', { user: req.user, key: process.env.STRIPEPUBLISHABLEKEY, key2: process.env.STRIPEACCOUNTID });
        }else{
            res.redirect("/login")
        }
    });
    app.post('/buyTickets', async function (req, res) {
        res.render('payment', { user: req.user, key: process.env.STRIPEPUBLISHABLEKEY, key2: process.env.STRIPEACCOUNTID });
    });

    app.post('/processPayment', async function (req, res) {
            try {
            console.log(req.body)
            
            const paymentMethodId = req.body.paymentMethodId;
            const name = req.body.name;
            const tickets = await Ticket.find({ userId: Number(req.body.userId) , bought : false });
            console.log({tickets})
            let price = 0;
            for (let i = 0; i < tickets.length; i++) {
                price = price + Number(tickets[i].value);
            }
            console.log({price})
            // Create a payment intent using the payment method
            const paymentIntent = await stripe.paymentIntents.create({
                amount: price * 100, // Amount in cents
                currency: 'usd',
                payment_method: paymentMethodId,
                confirm: true,
                description: `Payment from ${name}`,
            });
            console.log({paymentIntent})
            // Payment succeeded
            for (let i = 0; i < tickets.length; i++) {
                const event = await Event.findOne({ _id: Number(tickets[i].eventId) });
                let l = Number(tickets[i].value);
                for (let j = 0; j < l; j++) {
                    event.userIds.push(Number(tickets[i].userId));
                    event.ticketValue.push(Number(tickets[i].value));
                }
                await event.save();
                await Ticket.updateOne({ _id: Number(tickets[i]._id) }, { bought: true });
            }
            // const customerEmail = req.body.buyer.email;
            const customerEmail = req.body.email;
            const emailText = `Hello sir/ma'am\nYou have succesfully placed an order for tickets.\n\nWith regards,\nGreat Escape`;
            const emailSubject = `Order Placed`;
            sendOrderConfirmationEmail(customerEmail, emailText, emailSubject);
            res.json({success : true})
        } catch (error) {
            // Payment failed
            console.log("failed")
            console.log({error})
            res.json({success : false})
        }
      
    });



    app.post('/adminLogin', async function (req, res) {
        const temp = await User.findOne({ _id: 99 });
        const user = new User({
            username: req.body.username,
            password: req.body.password
        });
        if (temp) {
            req.login(user, function (err) {
                if (err) {
                    console.log(err);
                } else {
                    passport.authenticate('local', { failureRedirect: '/loginFail' })(req, res, function () {
                        res.redirect('/adminHome');
                    });
                }
            });
        } else {
            res.redirect('/adminLoginFail');
        }
    });

    app.post('/addEvent', async function (req, res) {
        const ids = await Id.findOne({ name: 'ids' });
        console.log(req.body)
        console.log({ ids })
        const startDate = new Date(req.body.eventStarts);
        const endDate = new Date(req.body.eventEnds);
        const event = new Event({
            _id: Number(ids.eventId),
            eventName: req.body.eventName,
            startdate: startDate,
            enddate: endDate,
            eventEnd: false,
            ticketValue: [0],
            userIds: [0]
        });
        await event.save();
        await Id.updateOne({ name: 'ids' }, { eventId: Number(ids.eventId) + 4 });


        res.redirect('/addEvent');
    });
    app.get("/*" , (req , res) =>{
        res.render("pageNotFound")
    })
}



app.listen(process.env.PORT || 5000, () => {
    console.log("server is running")
});