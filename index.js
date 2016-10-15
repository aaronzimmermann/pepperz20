//=========================================================
// Requirements
//=========================================================

// Chatbot
var restify = require('restify');
var builder = require('botbuilder');

// Loading external JSON
var request = require("request");

//=========================================================
// Load data file
//=========================================================

var url = "http://aaronzimmermann.net/data.json";
var customerData = null;

// Load the file
request({
    url: url,
    json: true
}, function (error, response, body) {

    if (!error && response.statusCode === 200) {
		customerData = body;
		console.log("Customer data JSON file loaded.");
    }
})

//=========================================================
// Bot Setup
//=========================================================

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});
  
// Create chat bot
var connector = new builder.ChatConnector({
    //appId: process.env.MICROSOFT_APP_ID,
    //appPassword: process.env.MICROSOFT_APP_PASSWORD
	appId: "afa947e1-f598-4479-9727-e7fc8136ab83",
    appPassword: "RMZKjeLjJJWaOvfXnpfacie"
});
var bot = new builder.UniversalBot(connector);
server.post('/api/messages', connector.listen());

// Create LUIS recognizer that points at our model and add it as the root '/' dialog for our Cortana Bot.
var model = 'https://api.projectoxford.ai/luis/v1/application?id=9eec8197-9eaa-49e2-8d39-69c6807bba42&subscription-key=54ced78cc26941b2b0c2048ea4e32fb8';
var recognizer = new builder.LuisRecognizer(model);
var intents  = new builder.IntentDialog({ recognizers: [recognizer] });
bot.dialog('/', intents );

//=========================================================
// In the future these should be added to Luis
//=========================================================
var quitWords = ["don't worry", "dont worry", "quit", "stop", "nevermind", "cancel", "exit", "changed my mind", "no"];


//=========================================================
// Intents
//=========================================================

// Check if the user is authenticated
intents.matches(/authenticate/i, [
	function (session, args, next) {
		if(!isUserAuthenticated(session)) {
			session.send("Hi " + getUserFirstName(session) + "! We've noticed this is your first time using the Pepper Money Chatbot.");
			session.send("Before we get started we need to authenticate who you are and which Pepper Money account you are using :)");
			session.beginDialog('/authentication');
		} else {
			session.send('You are authenthicated');
		}
	}
]);

// Default message
intents.onDefault(builder.DialogAction.send('Sorry could you rephrase that?'));

// Log in as new user
intents.matches('CurrentUser', [
    function (session, args, next) {
        session.send('You are currently: ' + getUserFirstName(session));
    }
]);

// Who is currently logged in
intents.matches('NewLogin', [
    function (session, args, next) {
        
		// Get new user
		var accountType = builder.EntityRecognizer.findEntity(args.entities, 'User');
		if(!loginAsUser(accountType.entity, session)) {
			session.send('That user does not exist.');
		} else {
			session.send('Now logged in as: ' + getUserFirstName(session));
		}
    }
]);

// Greeting
intents.matches('Greeting', [
    function (session, args, next) {
        session.send('Hi how can I help you?');
    }
]);

// Help
intents.matches('Help', [
    function (session, args, next) {
        session.send('I can show you an amount in an account or update a balance in one of your accounts.');
    }
]);

// List the user's accounts
intents.matches('ListAccounts', [
    function (session, args, next) {
		var accountNamesString = listAccounts(session);
        session.send('The accounts you have are ' + accountNamesString + ".");
    }
]);

// Enquire about an account
intents.matches('AccountEnquiry', [
	function (session, args, next) {
		
		var accountType = builder.EntityRecognizer.findEntity(args.entities, 'AccountType');
		
		// User did not state an account
		if(accountType == null) {
			session.beginDialog('/getAccountName');
		}
		
		// User states an account they do not have
		else if(!checkValidAccountName(accountType.entity, session)) {
			session.endDialog("I'm sorry but you don't have an " + accountType.entity + " account.");
		}
		
		// We have a valid account name, move onto the next step
		else {
			next({response: accountType.entity});
		}
    },
	function (session, results) {
		
		// Display the amount to the user
		session.send("Your " + results.response + " account is " + getAccountValue(results.response, session));
    }
]);
// Auto 
intents.matches('List', [
    function (session, args, next) {
    	
		session.send("Type “List” to get guided help anytime. I’m learning more everyday. Here are some things I can help you with:, Balance,Transactions,Live Help,Auto,Credit Cards,Mortgage,Interest Rates : ");
}]);
// Auto Repayment Date
intents.matches('Auto Repayment Date', [
    function (session, args, next)
     {
     var accountData = getAccount("auto", session);
	if(accountData != null) {
		session.send("Date:" + accountData.date);
	} else {
		session.send("Sorry the user doesnt have an account for auto");
	}
}]);
// Auto Repayment Amount
intents.matches('Auto Repayment Amount', [
    function (session, args, next)
     {
     var accountData = getAccount("auto", session);
	if(accountData != null) {
		session.send("Amount:" + accountData.amount);
	} else {
		session.send("Sorry the user doesnt have an account for auto");
	}
}]);


// Statement
intents.matches('Statement', [
    function (session, args, next) {
		session.send("Here is your statement: ");
        var msg = new builder.Message(session).attachments([{
			contentType: "application/pdf",
			contentUrl: "http://aaronzimmermann.net/statement.pdf"
		}]);
		session.send(msg);
    }
]);

//=========================================================
// Bots Dialogs
//=========================================================

// Authentication
bot.dialog('/authentication', [
    function (session) {
		builder.Prompts.text(session, "Please enter in your Pepper Money UserID.");
    },
	function (session, results) {
		
		// Get the user's response
		var enteredUserId = results.response;
		
		// Get the authentcation code
		var acode = sendAuthenticationEmail(session, enteredUserId);
		
		// There was a problem getting the user's email
		if(acode == null) {
			session.send("There was a problem looking up this UserID. Let's try again.")
			session.replaceDialog('/authentication');
		} else {
			session.send("We are going to authenticate your ID via your E-mail. Next you will need to enter the authentication code you receive via email into this chat. You should receive an email shortly, please enter the authentcation code below.");
			next({code: acode});
		}
    },
	function (session, results) {
		
		// Get the code the user entered
		var userEnteredCode = results.response;
		
		session.send(results.code + ", " + results.response);
	}
]);

// Getting the account name from the user
bot.dialog('/getAccountName', [
    function (session) {
		builder.Prompts.text(session, "Whichnam account are you interested in?");
    },
    function (session, results) {
		
		// Check for quit
		if(checkForQuit(results.response, session)) { }
		
		// The account name is valid
		else if(checkValidAccountName(results.response, session)) {
			session.endDialogWithResult(results);
		}
		
		// The account name is not valid
		else {
			session.replaceDialog('/rephraseAccountName');
		}
    }
]);

// Getting the user to rephrase the account name
bot.dialog('/rephraseAccountName', [
    function (session) {
		var accountNamesString = listAccounts(session);
		builder.Prompts.text(session, "Could you rephrase that account name? The accounts you have are " + accountNamesString + ".");
    },
    function (session, results) {
		
		// Check for quit
		if(checkForQuit(results.response, session)) { }
		
		// Get the account name this time
		else if(checkValidAccountName(results.response, session)) {
			session.send('Ah I see what you mean.');
			session.endDialogWithResult(results);
		}

		// Still unsure about the account name, prompt again
		else {
			session.replaceDialog('/rephraseAccountName');
		}
    }
]);

// End the conversation
bot.dialog('/endCurrentDialog', [
    function (session) {
		session.endDialog('Okay no worries. Let me know if there is anything else I can help with.');
    }
]);

//=========================================================
// Functions
//=========================================================

// Generates a random number
function randomInt (low, high) {
    return Math.floor(Math.random() * (high - low) + low);
}

// Sends an authentication email
// Returns the authentication code the user needs to enter
function sendAuthenticationEmail(p_session, p_id) {
	
	// Get email address corresponding to user ID
	var userEmail = getEmailFromID(p_session, p_id);
	
	// Dont send an email if the user does not exist
	if(userEmail == null) {
		return null;
	}
	
	// Generate random authentication code
	var acode = randomInt(10000, 19999);
	
	// Send email
	var emailMessage = "Hi, please find below your authentication code:\n\n" + acode + "\n\nKind regads,\n\nPepper Chatbot";
	sendAnEmail("noreply@pepperbot.com", userEmail, "Pepper Bot Authentication Code", emailMessage);
	
	return acode;
}

// Sends an email
function sendAnEmail(p_fromEmail, p_toEmail, p_subject, p_content) {
    var helper = require('sendgrid').mail;
    var from_email = new helper.Email(p_fromEmail);
    var to_email = new helper.Email(p_toEmail);
    var subject = p_subject;
    var content = new helper.Content('text/plain', p_content);
    var mail = new helper.Mail(from_email, subject, to_email, content);
    
    var sg = require("sendgrid")("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");
    var request = sg.emptyRequest({
      method: 'POST',
      path: '/v3/mail/send',
      body: mail.toJSON(),
    });
    sg.API(request, function(error, response) {
		console.log(response.statusCode);
		console.log(response.body);
		console.log(response.headers);
    });
}




// Logs in as the new user
// Returns true on sucess (the user exists)
// If there was a problem switching user then returns false
function loginAsUser(p_newUserName, p_session) {
	for(var i = 0; i < customerData.customers.length; i++) {
		if(customerData.customers[i].firstName.toLowerCase() == p_newUserName.toLowerCase()) {
			p_session.userData.currentUser = customerData.customers[i].id;
			console.log("Found " + customerData.customers[i].firstName)
			return true;
		}
	}
	console.log("User not found");
	return false;
}

// Returns the ID of the current user
function getCurrentUserID(p_session) {
	
	// Load the first user by default if no user has been selected
	if(p_session.userData.currentUser == null) {
		p_session.userData.currentUser = customerData.customers[0].id;
	}
	
	return p_session.userData.currentUser;
}

// Returns the data object for the current user
function getCurrentUserData(p_session) {
	
	// Get the username
	var userid = getCurrentUserID(p_session);
	
	// Get the user data
	for(var i = 0; i < customerData.customers.length; i++) {
		if(customerData.customers[i].id == userid) {
			return customerData.customers[i];
		}
	}
	
	// Return null if the user wasnt found
	return null;
}

// Checks if the user wants to quit
// Should be done a better way
function checkForQuit(p_message, p_session) {
	var word = p_message.toLowerCase();
	
	for(var i = 0; i < quitWords.length; i++) {
		if(word == quitWords[i]) {
			p_session.cancelDialog(0, '/endCurrentDialog');
			return true;
		}
	}
	
	return false;
}

// Checks if the user has the current account
// Returns true if the user does have the current account
// Otherwise returns false
// p_message: the name of the account e.g. "auto"
function checkValidAccountName(p_message, p_session) {
	
	// Convert input to lower case
	var word = p_message.toLowerCase();
	
	// Get data
	var data = getCurrentUserData(p_session);
	
	// Iterate through accounts
	for(var i = 0; i < data.accounts.length; i++) {
		if(data.accounts[i].type == word) {
			return true;
		}
	}
	
	return false;
}

// Returns a string in natural language listing all the accounts.
function listAccounts(p_session) {
	
	// Get data
	var data = getCurrentUserData(p_session);
	
	// Add account names to string
	var accountNamesString = "";
	
	// Iterate through accounts
	var numAccounts = data.accounts.length;
	for(var i = 0; i < numAccounts; i++) {
		
		// Add grammar
		if(i != 0 && i == numAccounts - 1) {
			accountNamesString += " and ";
		} else if(i != 0) {
			accountNamesString += ", ";
		}
		
		// Add the name of the account
		accountNamesString += data.accounts[i].type;
	}
	
	if(accountNamesString == "") {
		return "no accounts"
	} else {
		return accountNamesString;
	}
}

// Returns the account data
function getAccount(p_accountName, p_session) {
	
	// Get data
	var data = getCurrentUserData(p_session);
	
	// Iterate through accounts and return the target account
	var numAccounts = data.accounts.length;
	for(var i = 0; i < numAccounts; i++) {
		if(data.accounts[i].type == p_accountName.toLowerCase()) {
			return data.accounts[i];
		}
	}
	return null;
}

// Returns the value in an account
function getAccountValue(p_accountName, p_session) {
	var accountData = getAccount(p_accountName, p_session);
	if(accountData != null) {
		return accountData.amount;
	} else {
		return null;
	}
}

// Checks if the user is authenthicated
// Returns true if the user is authenthicated
// Otherwise returns false if the user has not been authenticated
function isUserAuthenticated(p_session) {
	var data = getCurrentUserData(p_session);
	return data.authenticated;
}

// gets the user's first name
function getUserFirstName(p_session) {
	var data = getCurrentUserData(p_session);
	return data.firstName;
}

// get email corresponding the id
function getEmailFromID(p_session, p_id) {
	for(var i = 0; i < customerData.customers.length; i++) {
		if(customerData.customers[i].id == p_id) {
			return customerData.customers[i].email;
		}
	}
	return null;
}

// gets the user's email
function getUserEmail(p_session) {
	var data = getCurrentUserData(p_session);
	return data.email;
}