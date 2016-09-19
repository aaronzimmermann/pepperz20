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
var dialog = new builder.IntentDialog({ recognizers: [recognizer] });
bot.dialog('/', dialog);

// Add intent handlers
//dialog.matches('builtin.intent.greeting', builder.DialogAction.send('Greeting User'));
dialog.onDefault(builder.DialogAction.send('Sorry could you rephrase that?'));



//=========================================================
// Bots Dialogs
//=========================================================

/*dialog.matches('builtin.intent.greeting', [
    function (session, args, next) {
        session.send('Hi how can I help you?');
    }
]);*/


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