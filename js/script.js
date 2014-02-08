// NAMESPACE / SETTINGS ///////////

var physicsDemo = {
	settings: {
		imgPath    : 'img/bird.png',
		fps        : 30,
		frequency  : 6,
		maxObjects : 35,
		width	   : 600,
		height     : 400,
		debug      : false,
		velocityIterations: 8,
		positionIterations: 3
	},
	events: {
		TICK: 'TICK',
		BIRD: 'BIRD',
		KILL: 'KILL'
	},
	$eventDispatcher: $({})
};

// DEMO //////////////
// this handles everything outside of b2d including easeljs functionality and visuals

physicsDemo.demoConstructor = function(){
	var stage = new createjs.Stage('demoCanvas');

	// INIT //////////////
	// setup the basic vars, stage, canvas, etc

	this.init = function() {
		var that = this;
		// setup the easeljs ticker (animation frame rate)
		createjs.Ticker.setFPS(physicsDemo.settings.fps);
		createjs.Ticker.useRAF = true;
		createjs.Ticker.addEventListener('tick', function(){
			that.tick();
		});

		// init box2d world
		physicsDemo.b2d.init();
	};

	// BIRD /////////////
	// creates an easeljs bitmap bird instance

	this.bird = function() {
		var birdBMP          = new createjs.Bitmap(physicsDemo.settings.imgPath);
		birdBMP.x            = Math.round(Math.random()*physicsDemo.settings.width);
		birdBMP.y            = -30;
		birdBMP.snapToPixel  = true;
		birdBMP.mouseEnabled = false;
		birdBMP.regX = birdBMP.regY = 25;   // it's important to set origin point to center of your bitmap
		stage.addChild(birdBMP);
		return birdBMP;
	};

	// TICK ///////////////
	// this is the framerate of the app, this is called many times per second, so it should be doing as little as possible
	var birdDelayCounter = 0;
	this.tick = function() {
		// update the physics simulation and objects in easel stage
		physicsDemo.$eventDispatcher.trigger(physicsDemo.events.TICK);
		stage.update();

		// spawn another bird every so often
		birdDelayCounter++;
		if(birdDelayCounter % physicsDemo.settings.frequency === 0) {  // delay so it doesn't spawn a bird on every frame (that would just be bananas)
			//console.log(this);
			birdDelayCounter = 0;
			var bird = this.bird();
			physicsDemo.$eventDispatcher.trigger(physicsDemo.events.BIRD, [bird]);
		}
	};

	// EVENTS ///////////
	physicsDemo.$eventDispatcher.on(physicsDemo.events.KILL, function(evt, bitmap) {
		// remove bitmap from screen when called
		stage.removeChild(bitmap);
	});
};

// B2D //////////////
/*
This handles everything on the box2d physics side of things.
The box2d syntax is quite long form, when building something with it
I reccomend creating helper functions for things like boxes, circles, etc
for this demo, however, I'm just keeping it simple and writing it all out
*/

physicsDemo.b2dConstructor = function(){
	// important box2d scale and speed vars
	var SCALE = 30, STEP = 20, TIMESTEP = 1/STEP;

	// common variables used for box2d
	var world,
		lastTimestamp = Date.now(),
		fixedTimestepAccumulator = 0,
		actors = [],
		bodies = [];

	// Shorthand variables for common box2d functions used in the demo
	var b2 = {
		vec2		   : Box2D.Common.Math.b2Vec2,
		bodyDef	       : Box2D.Dynamics.b2BodyDef,
		body 		   : Box2D.Dynamics.b2Body,
		fixtureDef     : Box2D.Dynamics.b2FixtureDef,
		fixture 	   : Box2D.Dynamics.b2Fixture,
		world		   : Box2D.Dynamics.b2World,
		polygonShape   : Box2D.Collision.Shapes.b2PolygonShape,
		circleShape    : Box2D.Collision.Shapes.b2CircleShape,
		debugDraw      : Box2D.Dynamics.b2DebugDraw
	};

	// INIT //////////////
	// setup the b2d world and edge boundaries for objects

	this.init = function() {
		// setup the world and all boundaries
		world = new b2.world(new b2.vec2(0,10), true);
		addDebug();
		// boundaries - floor
		var floorFixture = new b2.fixtureDef;
		floorFixture.density = floorFixture.restitution = 0.7;
		floorFixture.shape = new b2.polygonShape;
		floorFixture.shape.SetAsBox((physicsDemo.settings.width + 50) / SCALE, 10 / SCALE);
		var floorBodyDef = new b2.bodyDef;
		floorBodyDef.type = b2.body.b2_staticBody;
		floorBodyDef.position.x = -25 / SCALE;
		floorBodyDef.position.y = (physicsDemo.settings.height + 10) / SCALE;
		var floor = world.CreateBody(floorBodyDef);
		floor.CreateFixture(floorFixture);
		// boundaries - left
		var leftFixture = new b2.fixtureDef;
		leftFixture.shape = new b2.polygonShape;
		leftFixture.shape.SetAsBox(10 / SCALE, (physicsDemo.settings.height + 50) / SCALE);
		var leftBodyDef = new b2.bodyDef;
		leftBodyDef.type = b2.body.b2_staticBody;
		leftBodyDef.position.x = -10 / SCALE;
		leftBodyDef.position.y = -25 / SCALE;
		var left = world.CreateBody(leftBodyDef);
		left.CreateFixture(leftFixture);
		// boundaries - right
		var rightFixture = new b2.fixtureDef;
		rightFixture.shape = new b2.polygonShape;
		rightFixture.shape.SetAsBox(10 / SCALE, (physicsDemo.settings.height + 50) / SCALE);
		var rightBodyDef = new b2.bodyDef;
		rightBodyDef.type = b2.body.b2_staticBody;
		rightBodyDef.position.x = (physicsDemo.settings.width + 10) / SCALE;
		rightBodyDef.position.y = -25 / SCALE;
		var right = world.CreateBody(rightBodyDef);
		right.CreateFixture(rightFixture);
	};

	// CREATE /////////////
	// module for creating different b2d shapes with the option of attaching an actor (a bitmap to follow the physics object around)

	this.createCircle = function(bitmap) {
		var circleFixture = new b2.fixtureDef;
		circleFixture.density = 1;
		circleFixture.restitution = 0.1;
		circleFixture.shape = new b2.circleShape(24 / SCALE);
		var circleBodyDef = new b2.bodyDef;
		circleBodyDef.type = b2.body.b2_dynamicBody;
		if(bitmap) {
			circleBodyDef.position.x = bitmap.x / SCALE;
			circleBodyDef.position.y = bitmap.y / SCALE;
		}
		var circle = world.CreateBody(circleBodyDef);
		circle.CreateFixture(circleFixture);

		// assign actor
		if(bitmap) {
			var actor = new this.actor(circle, bitmap);
			actors.push(actor);
			circle.SetUserData(actor);  // set the actor as user data of the body so we can use it later: body.GetUserData()
		}
		bodies.push(circle);
	};

	// ACTOR //////////////
	// This attaches a bitmap (or any object of your choice) to the b2d physics object.

	this.actor = function(body, bitmap) {
		this.body = body;
		this.bitmap = bitmap;
		this.tick = function() {  // translate box2d positions to pixels
			var worldCenter = this.body.GetWorldCenter();
			this.bitmap.rotation = this.body.GetAngle() * 57.295;  // 180 / PI
			this.bitmap.x = worldCenter.x * SCALE;
			this.bitmap.y = worldCenter.y * SCALE;
		};
		this.remove = function() {
			physicsDemo.$eventDispatcher.trigger(physicsDemo.events.KILL, this.bitmap);
			//physicsDemo.demo.stage().removeChild(this.bitmap);
			actors.splice(actors.indexOf(this), 1);
			delete this.body;
			delete this.bitmap;
		};
		return this;
	};

	// TICK /////////////
	// Box2d update function. This is called many times per second from the easeljs ticker, so it's best to keep as simple as possible.
	// The tricky thing to note here is that delta time is used to avoid inconsistencies in simulation if frame rate drops in easeljs

	this.tick = function() {
		var now = Date.now(),
			dt  = now - lastTimestamp;
		fixedTimestepAccumulator += dt;
		lastTimestamp = now;
		while(fixedTimestepAccumulator >= STEP) {
			// update all active actors
			for(var i=0, l=actors.length; i<l; i++) { actors[i].tick(); }

			// remove bodies before world timestep
			if(bodies.length > physicsDemo.settings.maxObjects) {
	   			bodies[0].GetUserData().remove();
	   			world.DestroyBody(bodies[0]);
	   			bodies.splice(0,1);
	   		}

			world.Step(TIMESTEP, physicsDemo.settings.velocityIterations, physicsDemo.settings.positionIterations);

			fixedTimestepAccumulator -= STEP;
			if(physicsDemo.settings.debug) {
	   			world.m_debugDraw.m_sprite.graphics.clear();
	   			world.DrawDebugData();
	   		}
		}
	};

	// DEBUGGER ////////////
	// renders shapes of the physics objects so we can see what's going on under the hood

	var addDebug = function() {
		var debugContext = document.getElementById('debugCanvas').getContext('2d'),
			debugDraw    = new b2.debugDraw();
		debugDraw.SetSprite(debugContext);
		debugDraw.SetDrawScale(SCALE);
		debugDraw.SetFillAlpha(0.7);
		debugDraw.SetLineThickness(1.0);
		debugDraw.SetFlags(b2.debugDraw.e_shapeBit | b2.debugDraw.e_jointBit);
		world.SetDebugDraw(debugDraw);
	};

	// EVENTS
	var that = this;
	physicsDemo.$eventDispatcher.on(physicsDemo.events.TICK, this.tick);
	physicsDemo.$eventDispatcher.on(physicsDemo.events.BIRD, function(evt, bitmap) {
		that.createCircle(bitmap);
	});
};

// DOM //////////////
// handles all dom manipulation

physicsDemo.dom = (function(){
	// toggle debug draw
	var debug = (function(){
		var $debugToggle = $('#debugToggle'),
			$debugCanvas = $('#debugCanvas');
		var debugToggle = function() {
			if(physicsDemo.settings.debug) { $debugCanvas.removeClass('show'); physicsDemo.settings.debug = false; }
			else { $debugCanvas.addClass('show'); physicsDemo.settings.debug = true; }
		};
		$debugToggle.on('click', debugToggle);
	})();

	// set width & height of canvas on initial load
	var canvasSize = (function(){
		var $canvases = $('canvas');
		$canvases.each(function(){
			$(this).attr({'width': physicsDemo.settings.width, 'height': physicsDemo.settings.height});
		});
	})();
})();

// INIT ////////////////////////

physicsDemo.b2d = new physicsDemo.b2dConstructor();
physicsDemo.demo = new physicsDemo.demoConstructor();
physicsDemo.b2d.init();
physicsDemo.demo.init();