//=========================================================
// Requirements
//=========================================================

// Chatbot
var restify = require('restify');
var builder = require('botbuilder');

// File Server
var static = require('node-static');

//=========================================================
// File Server Setup
//=========================================================

var file = new static.Server();
require('http').createServer(function(request, response) {
  request.addListener('end', function() {
    file.serve(request, response);
  }).resume();
}).listen(process.env.PORT || 3000);


//=========================================================
// Bot Setup
//=========================================================
/*
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

// Add intent handlers

//=========================================================
// In the future these should be added to Luis
//=========================================================
var accountNames = ["repayment", "payout", "mortgage", "debit", "credit", "savings"];
var quitWords = ["don't worry", "dont worry", "quit", "stop", "nevermind", "cancel", "exit", "changed my mind", "no"];


//=========================================================
// Intents
//=========================================================

// Default message
intents.onDefault(builder.DialogAction.send('Sorry could you rephrase that?'));

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
		var accountNamesString = listAccounts();
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
		
		// User states an unknown account
		else if(!checkValidAccountName(accountType.entity)) {
			session.beginDialog('/rephraseAccountName');
		}
		
		// We have a valid account name, move onto the next step
		else {
			next({response: accountType.entity});
		}
    },
	function (session, results) {
		
		
		var amount = session.userData[results.response + "Amount"];
		if(amount == null) {
			session.send("You don't have anything in your " + results.response + ". If you tell me I can put an amount into one of your accounts.");
		} 
		
		// Display the amount to the user
		else {
			session.send("Your " + results.response + " is " + amount);
		}
    }
]);

// Update an amount in an account
intents.matches('AccountUpdate', [
    function (session, args, next) {
		
		// Entities
		var accountType = builder.EntityRecognizer.findEntity(args.entities, 'AccountType');
		var amount = builder.EntityRecognizer.findEntity(args.entities, 'builtin.money');
		
		// Select the account
		if(accountType != null && checkValidAccountName(accountType.entity) && amount != null) {
			session.userData[accountType.entity + "Amount"] = amount.entity;
			session.send("Your " + accountType.entity + " has been updated to " + amount.entity);
		}

		// One of the bits of information needed above was wrong
		else {
			session.send("Try saying that again please. If you are updating an account I need to know which account and the amount.");
		}
    }
]);

//=========================================================
// Bots Dialogs
//=========================================================

// Getting the account name from the user
bot.dialog('/getAccountName', [
    function (session) {
		builder.Prompts.text(session, "Which account are you interested in?");
    },
    function (session, results) {
		
		// Check for quit
		if(checkForQuit(results.response, session)) { /* Do nothing */}
		
		// The account name is valid
		else if(checkValidAccountName(results.response)) {
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
		var accountNamesString = listAccounts();
		builder.Prompts.text(session, "Could you rephrase that account name? The accounts you have are " + accountNamesString + ".");
    },
    function (session, results) {
		
		// Check for quit
		if(checkForQuit(results.response, session)) { /* Do nothing */}
		
		// Get the account name this time
		else if(checkValidAccountName(results.response)) {
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

// Checks it the user wants to quit
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

// Checks if the account name is valid
function checkValidAccountName(p_message) {
	var word = p_message.toLowerCase();
	
	for(var i = 0; i < accountNames.length; i++) {
		if(word == accountNames[i]) {
			return true;
		}
	}
	
	return false;
}

// Returns a string in natural language listing all the accounts.
function listAccounts() {
	var accountNamesString = "";
	for(var i = 0; i < accountNames.length; i++) {
		if(i != 0 && i == accountNames.length - 1) {
			accountNamesString += " and ";
		} else if(i != 0) {
			accountNamesString += ", ";
		}
		accountNamesString += accountNames[i];
	}
	return accountNamesString;
}*/