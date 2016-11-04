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

var url = "http://aaronzimmermann.net/pb/data.json";
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
// Load Phrase Lists
//=========================================================
var phraseListsUrl = "https://api.projectoxford.ai/luis/v1.0/prog/apps/9eec8197-9eaa-49e2-8d39-69c6807bba42/phraselists";
var phraseLists = null;

// Load the file
request({
    url: phraseListsUrl,
    json: true,
	headers: {
		'Ocp-Apim-Subscription-Key': process.env.LUIS_SUBSCRIPTION_KEY
	}
}, function (error, response, body) {

    if (!error && response.statusCode === 200) {
		phraseLists = body;
		console.log("Phrase lists loaded.");
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
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
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
// Constants
//=========================================================

// Eqnuiry ID's
var ENQUIRY_STATEMENT = "statement";
var ENQUIRY_REPAYMENT = "repayment";
var ENQUIRY_DISCHARGE = "discharge";

//=========================================================
// Intents
//=========================================================

// Greeting
intents.matches('Greeting', [
    function (session, args, next) {
        session.send('Hi how can I help you?');
    }
]);

// Check if an account exists
intents.matches('CheckAccountExists', [
    function (session, args, next) {
		
        // Get account type
		var accountType = builder.EntityRecognizer.findEntity(args.entities, 'AccountType');
		
		// User does not have this account
		if(!checkValidAccountName(accountType.entity, session)) {
			session.endDialog("I'm sorry but you don't have an " + accountType.entity + " account.");
		} else {
			
			// Set account context
			session.userData.accountContext = getAccountName(accountType.entity.toLowerCase());
			
			// If there is an enquiry context then trigger that enquiry
			if(session.userData.enquiryContext != null) {
				var args = {};
				args.enquiryName = session.userData.enquiryContext;
				session.beginDialog('/generalAccountEnquiry', args);
			}
			
			// Prompt the user for an enquiry
			else {
				session.endDialog("You do indeed have an " + accountType.entity + " account. What would you like to know?");
			}
		}
    }
]);

// Help
intents.matches('Help', [
    function (session, args, next) {
		
		// Clear the context
		session.userData.accountContext = null;
		session.userData.enquiryContext = null;
		
		// Send basic message
        session.endDialog('I can help you with any enquiries you have about an account, just type in your question. You can try starting with stating which account you are interested in or what you would like to know.');
    }
]);

// List the user's accounts
intents.matches('ListAccounts', [
    function (session, args, next) {
		
		// Clear the context
		session.userData.accountContext = null;
		session.userData.enquiryContext = null;
		
		// List all the users accounts
		var accountNamesString = listAccounts(session);
        session.send('You have a ' + accountNamesString + " account.");
    }
]);

// List the enquiries
intents.matches('ListEnquiries', [
    function (session, args, next) {
		
		// Clear the context
		session.userData.accountContext = null;
		session.userData.enquiryContext = null;
		
		// Send basic message
        session.endDialog("You can ask about your next repayment, payout or discharge amount or get a general account statement.");
    }
]);

// Check if the user is authenticated
intents.matches(/authenticate/i, [
	function (session, args, next) {
		session.beginDialog('/authentication');
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
        
		// Get the new user's name
		var userName = builder.EntityRecognizer.findEntity(args.entities, 'User');
		
		// Log in as the new user
		if(!loginAsUser(userName.entity, session)) {
			session.send('That user does not exist.');
		} else {
			
			// Clear the context
			session.userData.accountContext = null;
			session.userData.enquiryContext = null;
			
			// Send message
			session.send('Now logged in as: ' + getUserFirstName(session));
		}
    }
]);

// Enquire about an account discharge/payout amount
// For auto and mortgage
// #2 Enquiry (Auto)
// #4 Enquiry (Mortgage)
intents.matches('AccountDischarge', [
	function (session, args, next) {
		args.enquiryName = ENQUIRY_DISCHARGE;
		session.beginDialog('/generalAccountEnquiry', args);
    }
]);

// Repayment for any account (auto and mortgage)
// #1 Enquiry (Auto)
// #3 Enquiry (Mortgage)
intents.matches('Repayment', [
    function (session, args, next) {
		args.enquiryName = ENQUIRY_REPAYMENT;
		session.beginDialog('/generalAccountEnquiry', args);
	}
]);

// Statement for any account (auto and mortgage)
// #5 Enquiry (Mortgage)
// #7 Enquiry (Auto)
intents.matches('Statement', [
    function (session, args, next) {
		args.enquiryName = ENQUIRY_STATEMENT;
		session.beginDialog('/generalAccountEnquiry', args);
	}
]);

//=========================================================
// Bots Dialogs
//=========================================================

// Authentication
bot.dialog('/authentication', [
    function (session, args, next) {
		
		// Authentication intro
		session.send("Hi, we've noticed this is your first time using the Pepper Money Chatbot.");
		session.send("Before we get started we need to authenticate who you are and which Pepper Money account you are using. :)");
		
		// Prompt for the userID
		session.beginDialog('/authenticationUserID');
    },
	function (session, results, next) {
		
		// Get the user's response
		var acode = results.response;
		
		// Prompt for the authentcation code
		var args = {};
		args.acode = acode;
		session.beginDialog('/authenticationCode', args);
    },
	function (session, results) {
		
		// Tell the user authentcation is complete
		session.endDialog('We have successfully linked your Facebook account with Pepper Money.');
	}
]);

// Dialog for getting the user to enter their user id
bot.dialog('/authenticationUserID', [
    function (session, args, next) {
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
			session.replaceDialog('/authenticationUserID');
		} else {
			session.endDialogWithResult({response: acode});
		}
    }
]);

// Dialog for getting the user to enter the authentication code
bot.dialog('/authenticationCode', [
	function (session, args, next) {
		
		// Save authentcation code
		session.dialogData.code = args.acode;
		
		// Prompt for authentcation code
		builder.Prompts.text(session, "We are going to authenticate your ID via your E-mail. Next you will need to enter the authentication code you receive via email into this chat. You should receive an email shortly, please enter the authentcation code below.");
    },
	function (session, results) {
		
		// Get the code the user entered
		var userEnteredCode = results.response;
		
		// Code matches
		if(userEnteredCode == "" + session.dialogData.code) {
			session.endDialog('Thank you, that authentcation code is correct.'); 
		} 
		
		// Code fails
		else {
			
			// Reprompt for authentcation code
			session.send('Oops that code was incorrect. Please try and enter it again.');
			var args = {};
			args.acode = session.dialogData.code;
			session.beginDialog('/authenticationCode', args);
		}
	}
]);

// A general bot dialogue for an account enquiry such as statement or repayment
// the ID of the account enquiry must be passed as in args
bot.dialog('/generalAccountEnquiry', [
   function (session, args, next) {
	   
	   // Pass the name of the enquiry
	   session.dialogData.enquiryName = args.enquiryName;
		
		// Get account type
		var accountType = builder.EntityRecognizer.findEntity(args.entities, 'AccountType');
		
		// User did not state an account
		if(accountType == null) {
			
			// User doesn't have any accounts
			if(getNumAccounts(session) == 0) {
				session.endDialog("I'm sorry but you don't have any accounts.");
			} 
			
			// Use the account in the account context
			else if(session.userData.accountContext != null) {
				next({response: session.userData.accountContext});
			}
			
			// Get the account name
			else {
				
				// Clear the account context
				session.userData.accountContext = null;
				
				// Set enquiry context
				session.userData.enquiryContext = args.enquiryName;
				
				// Ask the user which account they would like
				session.beginDialog('/getAccountName');
			}
		}
		
		// User states an account they do not have
		else if(!checkValidAccountName(accountType.entity, session)) {
			
			// Clear the account context
			session.userData.accountContext = null;
			
			// Send message
			session.endDialog("I'm sorry but you don't have an " + accountType.entity + " account.");
		}
		
		// We have a valid account name, move onto the next step
		else {
			
			// Clear the account context
			session.userData.accountContext = null;
			
			// Next waterfall step
			next({response: accountType.entity});
		}
	},
	function (session, results) {
		
		// Get enquiry name
		var enquiryName = session.dialogData.enquiryName;
		
		// Get account name/ID
		var accountID = getAccountName(results.response);
		
		// Get account info
		var accountInfo = getAccount(accountID, session);
		
		// Do the enquiry
		if(enquiryName == ENQUIRY_STATEMENT) {
			
			// Show a text summary
			session.send("Here is a summary of your " + accountID + " account statement: ");
		
			// Send an image
			var msg = new builder.Message(session).attachments([{
				contentType: "image/png",
				contentUrl: accountInfo.statement.img
			}]);
			session.endDialog(msg);
			
		} else if(enquiryName == ENQUIRY_REPAYMENT) {
			
			// Send message
			session.endDialog("Your next repayment amount for your " + accountID + " account will be " + accountInfo.repaymentAmount + " due on " + accountInfo.repaymentDate + ".");
		
		} else if(enquiryName == ENQUIRY_DISCHARGE) {
			
			// Send message
			session.endDialog("You have " + accountInfo.dischargeAmount + " owing on your " + accountID + " account.");
		
		}
		
		// Clear enquiry context
		session.userData.enquiryContext = null;
	}
]);

// Getting the account name from the user
// This is used when the user specified an intent but not the account name
// If the user has no accounts then the dialog will return immediately with "NULL"
// If the user has only one account then the dialog will return immediately with that account name
bot.dialog('/getAccountName', [
    function (session) {
		
		// If the user does not have any accounts
		if(getNumAccounts(session) == 0) {
			session.endDialogWithResult({response: "NULL"});
		}
		
		// If the user only has one account then just assume that account
		else if(getNumAccounts(session) == 1) {
			var defaultAccountName = getDefaultAccountName(session);
			session.endDialogWithResult({response: defaultAccountName});
		}
		
		// Ask the user which account they would like
		else {
			builder.Prompts.text(session, "Which account are you interested in?");
		}
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
			session.send("You don't have an " + results.response + " account. Could you try rephrasing that account?")
			//session.replaceDialog('/getAccountName');
			session.cancelDialog(0);
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
	var acode = randomInt(10000, 99999);
	
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
   
    var sg = require("sendgrid")(process.env.SENDGRID);
    var request = sg.emptyRequest({
      method: 'POST',
      path: '/v3/mail/send',
      body: mail.toJSON(),
    });
    sg.API(request, function(error, response) {""
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
			return true;
		}
	}
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
	var word = getAccountName(p_message.toLowerCase());
	
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
		return "no accounts";
	} else {
		return accountNamesString;
	}
}

// Returns the account data for the specified account name
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

// Gets the number of accounts the user has
function getNumAccounts(p_session) {
	var data = getCurrentUserData(p_session);
	return data.accounts.length;
}

// Get's the user's default account
// The default account is the first account in their list
// Returns null if there is no accounts
function getDefaultAccountName(p_session) {
	if(getNumAccounts(p_session) == 0) {
		return null;
	} else {
		var data = getCurrentUserData(p_session);
		return data.accounts[0].type;
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

// gets an account name (auto or mortgage) from an account token e.g. car or house
// if the token does not match either auto or mortgage null is returned
function getAccountName(p_token) {
	for(var i = 0; i < phraseLists.length; i++) {
		if(phraseLists[i].Name == "synonyms_auto" || phraseLists[i].Name == "synonyms_mortgage") {
			var phraseList = phraseLists[i].Phrases.split(",");
			for(var j = 0; j < phraseList.length; j++) {
				if(p_token == phraseList[j]) {
					return phraseList[0];
				}
			}
		}
	}
	return null;
}