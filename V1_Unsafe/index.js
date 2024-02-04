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

const port = process.env.PORT || 3000;

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

app.get("/createTables", async (req, res) => {
	const create_tables = include("database/create_tables");

	var success = create_tables.createTables();
	if (success) {
		res.render("successMessage", { message: "Created tables." });
	} else {
		res.render("errorMessage", { error: "Failed to create tables." });
	}
});

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
	const data = `'${username}', '${email}', '${hashedPassword}'`;
	const createUserQuery = `		
	INSERT INTO user
	(username, email, password)
	VALUES
	(${data});`;
	try {
		const success = await database.query(createUserQuery);
		console.log("Successfully created user");
		console.log(success[0]);
		let getUserQuery = `
		SELECT username
		FROM user
		WHERE username LIKE '${username}'
		`;

		var results = await database.query(getUserQuery);
		res.send(
			"You successfully register a new user: " + results[0][0].username
		);
	} catch (err) {
		console.log("Error getting users");
		console.log(err);
		return false;
	}
});

app.post("/loggingin", async (req, res) => {
	var username = req.body.username;
	var password = req.body.password;
	let getUserQuery = `
	SELECT username, password
	FROM user
	WHERE username LIKE '${username}'
	`;
	try {
		var results = await database.query(getUserQuery);
		console.log(results[0][0]);
	} catch (err) {
		console.log("Error getting users");
		console.log(err);
		return false;
	}

	var password_compare = bcrypt.compareSync(password, results[0][0].password);
	console.log("password: " + password_compare);
	let verifyUserQuery = `
	SELECT username
	FROM user
	WHERE username LIKE '${username}' AND ${password_compare}
	`;
	try {
		var verifyResults = await database.query(verifyUserQuery);
		req.session.authenticated = true;
		req.session.username = username;
		req.session.cookie.maxAge = expireTime;
		console.log(verifyResults[0][0].username);
		res.send("You are successfully logged in as " + results[0][0].username);
	} catch (err) {
		console.log("Wrong password!");
		res.send("Incorrect password. Please try again.");
		console.log(err);
		return false;
	}
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
