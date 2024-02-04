require("./utils");

require("dotenv").config();
const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const bcrypt = require("bcrypt");
const saltRounds = 12;

const database = include("databaseConnection");
const db_utils = include("database/db_utils");
const db_users = include("database/users");
const success = db_utils.printMySQLVersion();

const port = process.env.PORT || 3020;

const app = express();

const expireTime = 24 * 60 * 60 * 1000; //expires after 1 day  (hours * minutes * seconds * millis)

/* secret information section */
const mongodb_host = process.env.MONGODB_HOST;
const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET;

const node_session_secret = process.env.NODE_SESSION_SECRET;
/* END secret section */

app.set("view engine", "ejs");

app.use(express.urlencoded({ extended: false }));

var mongoStore = MongoStore.create({
	mongoUrl: `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/sessions`,
	crypto: {
		secret: mongodb_session_secret,
	},
});

app.use(
	session({
		secret: node_session_secret,
		store: mongoStore, //default is memory store
		saveUninitialized: false,
		resave: true,
	})
);

app.get("/", (req, res) => {
	const authenticated = req.session.authenticated;
	res.render("index", {
		authenticated: authenticated,
	});
});

app.get("/signup", (req, res) => {
	res.render("signup");
});

// app.get("/createTables", async (req, res) => {
// 	const create_tables = include("database/create_tables");

// 	var success = create_tables.createTables();
// 	if (success) {
// 		res.render("successMessage", { message: "Created tables." });
// 	} else {
// 		res.render("errorMessage", { error: "Failed to create tables." });
// 	}
// });

app.get("/createUser", (req, res) => {
	res.render("createUser");
});

app.get("/login", (req, res) => {
	res.render("login");
});

app.post("/submitUser", async (req, res) => {
	var username = req.body.username;
	var email = req.body.email;
	var password = req.body.password;

	var hashedPassword = bcrypt.hashSync(password, saltRounds);

	var success = await db_users.createUser({
		user: username,
		email: email,
		hashedPassword: hashedPassword,
	});

	if (success) {
		var results = await db_users.getUsers();

		res.render("loggedin", { users: results });
	} else {
		res.render("errorMessage", { error: "Failed to create user." });
	}
});

app.post("/loggingin", async (req, res) => {
	var username = req.body.username;
	var password = req.body.password;

	var results = await db_users.getUser({
		user: username,
		hashedPassword: password,
	});

	if (results) {
		if (results.length == 1) {
			//there should only be 1 user in the db that matches
			if (bcrypt.compareSync(password, results[0].password)) {
				req.session.authenticated = true;
				req.session.username = username;
				req.session.cookie.maxAge = expireTime;

				res.redirect("/loggedIn");
				return;
			} else {
				console.log("invalid password");
			}
		} else {
			console.log(
				"invalid number of users matched: " +
					results.length +
					" (expected 1)."
			);
			res.redirect("/login");
			return;
		}
	}

	console.log("user not found");
	//user and password combination not found
	res.redirect("/login");
});

app.use("/members", sessionValidation);
app.get("/members", (req, res) => {
	var username = req.session.username;
	var email = req.session.email;
	var cat = Math.floor(Math.random() * (4 - 0 + 1)) + 0;
	console.log(req.session);
	res.render("members", {
		user: username,
		cat: cat,
	});
});

app.get("/signout", (req, res) => {
	req.session.destroy();
	res.render("index", {
		authenticated: false,
	});
});

function isValidSession(req) {
	if (req.session.authenticated) {
		return true;
	}
	return false;
}

function sessionValidation(req, res, next) {
	if (!isValidSession(req)) {
		req.session.destroy();
		res.redirect("/login");
		return;
	} else {
		next();
	}
}

app.use("/loggedin", sessionValidation);

app.get("/loggedin", (req, res) => {
	res.render("loggedin");
});

app.use(express.static(__dirname + "/public"));

app.get("*", (req, res) => {
	res.status(404);
	res.render("404");
});

app.listen(port, () => {
	console.log("Node application listening on port " + port);
});
