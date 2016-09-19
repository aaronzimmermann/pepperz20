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
		console.log(next);
		
		// Entities
		var accountType = builder.EntityRecognizer.findEntity(args.entities, 'AccountType');
		console.log(accountType);
		
		// User did not state an account
		if(accountType == null) {
			session.send("Which account do you want to know about?");
		}

		// Select the account
		else if(accountType.entity == "repayment") {
			
			// Get the amount
			session.send("Your " + accountType.entity + " is " + session.userData.repaymentAmount);
			
		}

		// Not sure what account this is
		else {
			session.beginDialog('/rephraseAccountName');
		}
    }
]);

// Update
intents.matches('Update', [
    function (session, args, next) {
		
		// Entities
		var accountType = builder.EntityRecognizer.findEntity(args.entities, 'AccountType');
		var amount = builder.EntityRecognizer.findEntity(args.entities, 'builtin.money');
		console.log(accountType);
		
		// Select the account
		if(accountType == null) {
			session.beginDialog('/getAccountName');
		} else if(accountType.entity == "repayment") {
			
			// No amount was specified
			if(amount == null) {
				session.send("What would you like the new amount to be?");
			} 
			
			// Update the amount
			else {
				session.userData.repaymentAmount = amount.entity;
				session.send("Your " + accountType.entity + " has been updated to " + amount.entity);
			}
			
		} else {
			session.send('Could you rephrase which account you want to update?');
		}
    }
]);

/*// Getting the account name from the user
bot.dialog('/getAccountName', [
    function (session) {
		builder.Prompts.text(session, "Which account would you like to update?");
    },
    function (session, results) {
		if(checkForQuit(results.response == "quit" || results.response == "nevermind") {
			
		}
        session.userData.name = results.response;
        session.endDialog();
    }
]);*/

// Getting the user to rephrase the account name
bot.dialog('/rephraseAccountName', [
    function (session) {
		builder.Prompts.text(session, "Could you rephrase that account name?");
    },
    function (session, results) {
		
		// Check for quit
		if(checkForQuit(results.response, session)) {
			
		}
		
		// Get the account name this time
		else if(results.response == "repayment") {
			session.send('Got it.');
			session.endDialogWithResult(results);
		}

		// Still unsure about the account name
		// Prompt again
		else {
			session.replaceDialog('/rephraseAccountName');
		}
    }
]);

// Ending the dialogue
bot.dialog('/endCurrentDialog', [
    function (session) {
		session.endDialog('Okay no worries. Is there anything else I can help with?');
    }
]);

function checkForQuit(p_message, p_session) {
	console.log(typeof p_message);
	var word = p_message.toLowerCase();
	var quitWords = ["don't", "worry", "quit", "stop", "nevermind"];
	for(var i = 0; i < quitWords.length; i++) {
		if(word == quitWords[i]) {
			p_session.cancelDialog(0, '/endCurrentDialog');
			return true;
		}
	}
}