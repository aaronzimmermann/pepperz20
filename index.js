//=========================================================
// Requirements
//=========================================================

var restify = require('restify');
var builder = require('botbuilder');

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
    /*appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD*/
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
// Bots Dialogs
//=========================================================

// Default message
intents.onDefault(builder.DialogAction.send('Sorry could you rephrase that?'));

// Greeting
intents.matches('Greeting', [
    function (session, args, next) {
        session.send('Hi how can I help you?');
    }
]);

// Enquiry
intents.matches('Enquiry', [
	function (session, args, next) {
		
		console.log(args);
		console.log(">> 1. Account enquiry.");
		
		var accountType = builder.EntityRecognizer.findEntity(args.entities, 'AccountType');
		console.log("accountType: " + accountType);
		
		// User did not state an account
		if(accountType == null) {
			console.log(">> accountType == null");
			session.beginDialog('/getAccountName');
		}
		
		// User states an unknown account
		else if(!checkValidAccountName(accountType.entity)) {
			console.log(">> !checkValidAccountName(accountType.entity)");
			session.beginDialog('/rephraseAccountName');
		}
		
		// We have a valid account name, move onto the next step
		else {
			console.log(">> Moving to next step of account enquiry.");
			next({response: accountType.entity});
		}
    },
	function (session, results) {
		
		console.log(">> results: " + results.response);

		session.send("Your " + results.response + " is " + session.userData[results.response + "Amount"]);
    }
]);

// Update

intents.matches('Update', [
    function (session, args, next) {
		
		// Entities
		var accountType = builder.EntityRecognizer.findEntity(args.entities, 'AccountType');
		var amount = builder.EntityRecognizer.findEntity(args.entities, 'builtin.money');
		
		// Select the account
		if(accountType != null && checkValidAccountName(accountType.entity) && amount != null) {
			session.userData[accountType.entity + "Amount"] = amount.entity;
			session.send("Your " + accountType.entity + " has been updated to " + amount.entity);
		} else {
			session.send("Try saying that again please.");
		}
    }
]);

// Getting the account name from the user
bot.dialog('/getAccountName', [
    function (session) {
		console.log(">> 1. Prompting the user for the account name.");
		builder.Prompts.text(session, "Which account are you interested in?");
    },
    function (session, results) {
		
		// Check for quit
		if(checkForQuit(results.response, session)) { /* Do nothing */}
		
		// The account name is valid
		else if(checkValidAccountName(results.response)) {
			console.log(">> 1. Gotten the account name from the user.");
			session.endDialogWithResult(results);
		}
		
		// The account name is not valid
		else {
			console.log(">> 1. Need the user to rephrase the account name.");
			session.replaceDialog('/rephraseAccountName');
		}
    }
]);

// Getting the user to rephrase the account name
bot.dialog('/rephraseAccountName', [
    function (session) {
		builder.Prompts.text(session, "Could you rephrase that account name?");
    },
    function (session, results) {
		
		// Check for quit
		if(checkForQuit(results.response, session)) {
			// Do nothing
		}
		
		// Get the account name this time
		else if(checkValidAccountName(results.response)) {
			console.log(">> 2. Gotten the account name from the user.");
			session.send('Oh I see what you mean.');
			session.endDialogWithResult(results);
		}

		// Still unsure about the account name
		// Prompt again
		else {
			console.log(">> 2. Need the user to rephrase the account name.");
			session.replaceDialog('/rephraseAccountName');
		}
    }
]);

// Ending the dialogue
bot.dialog('/endCurrentDialog', [
    function (session) {
		console.log(">> 1. Ending current dialogue stack.");
		session.endDialog('Okay no worries. Is there anything else I can help with?');
    }
]);

// Checks it the user wants to quit
function checkForQuit(p_message, p_session) {
	var word = p_message.toLowerCase();
	
	// All the quit words here
	var quitWords = ["don't worry", "quit", "stop", "nevermind", "cancel", "exit"];
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
	
	// All the valid accounts here
	var words = ["repayment, debit, credit"];
	for(var i = 0; i < words.length; i++) {
		if(word == words[i]) {
			return true;
		}
	}
	
	return false;
}