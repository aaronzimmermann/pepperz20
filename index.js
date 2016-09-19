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
		
		// Entities
		var accountType = builder.EntityRecognizer.findEntity(args.entities, 'AccountType');
		console.log(accountType);
		
		// Select the account
		if(accountType == null) {
			session.send("Which account do you want to know about?");
		} else if(accountType.entity == "repayment") {
			
			// Get the amount
			session.send("Your " + accountType.entity + " is " + session.userData.repaymentAmount);
			
		} else {
			session.send('Could you rephrase which account you want to know about?');
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

// Getting the account name from the user
bot.dialog('/getAccountName', [
    function (session) {
		builder.Prompts.text(session, "Which account?");
    }/*,
    function (session, results) {
        session.userData.name = results.response;
        session.endDialog();
    }*/
]);


/*
var intents = new builder.IntentDialog();
bot.dialog('/', intents);
*/

/*
bot.dialog('/', function (session) {
    session.send('Hello World');
});
*/

/*
bot.dialog('/', [
    function (session) {
        builder.Prompts.text(session, 'Hi! What is your name?');
    },
    function (session, results) {
        session.send('Hello %s!', results.response);
    }
]);
*/
/*
intents.matches(/^change name/i, [
    function (session) {
        session.beginDialog('/profile');
    },
    function (session, results) {
        session.send('Ok... Changed your name to %s', session.userData.name);
    }
]);

intents.onDefault([
    function (session, args, next) {
        if (!session.userData.name) {
            session.beginDialog('/profile');
        } else {
            next();
        }
    },
    function (session, results) {
        session.send('Hello %s!', session.userData.name);
    }
]);

bot.dialog('/profile', [
    function (session) {
        builder.Prompts.text(session, 'Hi! What is your name?');
    },
    function (session, results) {
        session.userData.name = results.response;
        session.endDialog();
    }
]);
*/