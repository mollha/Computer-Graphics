let VSHADER_SOURCE = [
    'attribute vec4 a_Position;',
    'attribute vec4 a_Color;',
    'attribute vec4 a_Normal;',
    'attribute vec2 a_TexCoords;',

    'uniform mat4 u_ProjMatrix;',
    'uniform mat4 u_ViewMatrix;',
    'uniform mat4 u_ModelMatrix;',
    'uniform mat4 u_NormalMatrix;',
    'varying vec4 v_Color;',
    'varying vec3 v_Normal;',
    'varying vec2 v_TexCoords;',
    'varying vec3 v_Position;',

    'void main() {',
    '  gl_Position = u_ProjMatrix * u_ViewMatrix * u_ModelMatrix * a_Position;',
    '  v_Position = vec3(u_ModelMatrix * a_Position);',
    '  v_Normal = normalize(vec3(u_NormalMatrix * a_Normal));',
    '  v_Color = a_Color;',
    '  v_TexCoords = a_TexCoords;',
    '}'].join('\n');

let FSHADER_SOURCE = [
    'precision mediump float;',
    'uniform bool u_UseTextures;',
    'uniform vec3 u_LightPosition[4];',
    'uniform vec3 u_LightColor[4];',
    'uniform vec3 u_AmbientLight;',
    'varying vec3 v_Normal;',
    'varying vec3 v_Position;',
    'varying vec4 v_Color;',

    'uniform sampler2D u_Sampler;',
    'varying vec2 v_TexCoords;',
    'void main() {',
    '  vec4 col = u_UseTextures ? texture2D(u_Sampler, v_TexCoords) : v_Color;',
    '  vec3 normal = normalize(v_Normal);',
    '  vec3 f_color = u_AmbientLight * col.rgb;',
    '  vec3 diffuse;',
    '  for (int i = 0; i < 3; i++) {',
    '       vec3 lightDirection = normalize(u_LightPosition[i] - v_Position);',
    '       float nDotL = max(dot(lightDirection, normal), 0.0);',
    '       diffuse = u_LightColor[i] * col.rgb * nDotL;',
    '       float distanceToLight = length(u_LightPosition[i] - v_Position);',
    '       float attenuation = 1.0 / (1.0 + 0.035 * pow(distanceToLight, 2.0));',
    '       f_color += attenuation * diffuse;',
    '   }',
    '   gl_FragColor = vec4(f_color, col.a);',
    '}'].join('\n');

let curtain_height = 0.1;
let c_var = 0.1;

let modelMatrix = new Matrix4(); // The model matrix
let viewMatrix = new Matrix4();  // The view matrix
let projMatrix = new Matrix4();  // The projection matrix
let normalMatrix = new Matrix4();  // Coordinate transformation matrix for normal

let u_ModelMatrix, u_ViewMatrix, u_NormalMatrix, u_ProjMatrix, u_LightColor,
    u_LightPosition, u_Sampler, u_UseTextures, u_AmbientLight;

// -------------- Initial values --------------
let clear_color = [196/255, 196/255, 1, 1.0];
let sun_position = [-30, 10, 15];
let sun_color = [1, 1, 1];
let car_color = [15/255, 10/255, 153/255];  // Initialise car color

let L_POSITIONS = [
    6, 7.75, 4.75, -6, 7.75, 4.75,
    0, 7.75, 13.75, sun_position[0], sun_position[1], sun_position[2]
];

let L_COLORS = [
    0/255, 0/255, 0/255, 0/255, 0/255, 0/255,
    0/255, 0/255, 0/255, sun_color[0], sun_color[1], sun_color[2]
];

let mat_stack = [];
let STREET_LIGHTS = false;
let SUNLIGHT = 1;
let DOOR_OPEN = false;
let extend = false; // Whether or not "5" is currently pressed - extends blinds
// -------------------------------------------

// -------------- Initial perspective -------------
let x_Rot = 125;    // Angle to look left or right
let y_Rot = 100;    // Angle to look up or down
// ------------------------------------------------

let xAngle = 0.0;
let yAngle = 0.0;
let keys = [];  // Stores the key(s) that are currently pressed
let x_coord = -25;  // eye x co-ordinate
let y_coord = 5;    // eye y co-ordinate
let z_coord = 20;   // eye z co-ordinate


let prev = 0;
let curr = 0;
let car = false;    // Whether or not a car currently exists
let z_inc = -1;     // centres the car on the road
let x_inc = 1000;   // car x increments
let wheel_rot = 0;
let hud;

function main() {
    let canvas = document.getElementById('webgl');
    hud = document.getElementById('hud');
    let gl = getWebGLContext(canvas);
    if (!gl) {
        console.log('Failed to get the rendering context for WebGL');
        return;
    }
    if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
        console.log('Failed to intialize shaders.');
        return;
    }


    gl.clearColor(clear_color[0], clear_color[1], clear_color[2], clear_color[3]);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Clear buffers
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    u_UseTextures = gl.getUniformLocation(gl.program, "u_UseTextures");
    // Initially, textures are OFF
    gl.uniform1i(u_UseTextures, 0);

    let brickTexture = gl.createTexture();
    brickTexture.image = new Image();
    brickTexture.image.crossOrigin = "anonymous";
    brickTexture.image.src = './textures/brick.png';
    brickTexture.image.onload = function () {
        loadTexture(gl, brickTexture, gl.TEXTURE1);
    };

    let roofTexture = gl.createTexture();
    roofTexture.image = new Image();
    roofTexture.image.crossOrigin = "anonymous";
    roofTexture.image.src = './textures/roof.jpg';
    roofTexture.image.onload = function () {
        loadTexture(gl, roofTexture, gl.TEXTURE0);
    };

    let groundTexture = gl.createTexture();
    groundTexture.image = new Image();
    groundTexture.image.crossOrigin = "anonymous";
    groundTexture.image.src = './textures/ground.png';
    groundTexture.image.onload = function () {
        loadTexture(gl, groundTexture, gl.TEXTURE2);
    };

    let concreteTexture = gl.createTexture();
    concreteTexture.image = new Image();
    concreteTexture.image.crossOrigin = "anonymous";
    concreteTexture.image.src = './textures/concrete.jpg';
    concreteTexture.image.onload = function () {
        loadTexture(gl, concreteTexture, gl.TEXTURE3);
    };

    let darkConcreteTexture = gl.createTexture();
    darkConcreteTexture.image = new Image();
    darkConcreteTexture.image.crossOrigin = "anonymous";
    darkConcreteTexture.image.src = './textures/darkconcrete.png';
    darkConcreteTexture.image.onload = function () {
        loadTexture(gl, darkConcreteTexture, gl.TEXTURE4);
    };

    let wallpaperTexture = gl.createTexture();
    wallpaperTexture.image = new Image();
    wallpaperTexture.image.crossOrigin = "anonymous";
    wallpaperTexture.image.src = './textures/wallpaper.jpg';
    wallpaperTexture.image.onload = function () {
        loadTexture(gl, wallpaperTexture, gl.TEXTURE5);
    };

    let doorTexture = gl.createTexture();
    doorTexture.image = new Image();
    doorTexture.image.crossOrigin = "anonymous";
    doorTexture.image.src = './textures/door.jpg';
    doorTexture.image.onload = function () {
        loadTexture(gl, doorTexture, gl.TEXTURE6);
    };

    // Get the storage locations of uniform attributes
    u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
    u_ViewMatrix = gl.getUniformLocation(gl.program, 'u_ViewMatrix');
    u_NormalMatrix = gl.getUniformLocation(gl.program, 'u_NormalMatrix');
    u_ProjMatrix = gl.getUniformLocation(gl.program, 'u_ProjMatrix');
    u_LightColor = gl.getUniformLocation(gl.program, 'u_LightColor');
    u_LightPosition = gl.getUniformLocation(gl.program, 'u_LightPosition');
    u_AmbientLight = gl.getUniformLocation(gl.program, 'u_AmbientLight');
    u_UseTextures = gl.getUniformLocation(gl.program, "u_UseTextures");


    if (!u_ModelMatrix || !u_ViewMatrix || !u_NormalMatrix || !u_ProjMatrix || !u_LightColor || !u_LightPosition) {
        console.log('Failed to Get the storage location');
        return;
    }

    projMatrix.setPerspective(50, 800 / 800, 1, 100);
    gl.uniformMatrix4fv(u_ViewMatrix, false, viewMatrix.elements);
    gl.uniformMatrix4fv(u_ProjMatrix, false, projMatrix.elements);

    u_Sampler = gl.getUniformLocation(gl.program, 'u_Sampler');
    gl.uniform3f(u_AmbientLight,  1, 1, 1);

    let lerp = function(a, b, u) {
        return (1 - u) * a + u * b;
    };

    let fade = function (start, end, duration) {
        let r = start[0];
        let g = start[1];
        let b = start[2];
        let interval = 10;
        let steps = duration / interval;
        let step_u = 1.0 / steps;
        let u = 0.1;
        let u_interval = setInterval(function() {
            if (u >= 1.0) {
                clearInterval(u_interval);
            }
            clear_color = [r, g, b, 1];
            r = lerp(start[0], end[0], u).toFixed(4);
            g = lerp(start[1], end[1], u).toFixed(4);
            b = lerp(start[2], end[2], u).toFixed(4);
            u += step_u;
        }, interval);
    };

    window.addEventListener("keydown", (event) => {
        switch (event.key) {
            case "1":
                if (SUNLIGHT === 1) {
                    fade(clear_color, [255/255, 152/255, 137/255, 1.0], 100);
                    sun_color = [0.2, 0.2, 0.2];
                    sun_position = [-10, 30, -20];
                    gl.uniform3f(u_AmbientLight, 255/255, 125/255, 50/255);
                    SUNLIGHT = 2;
                }
                else if(SUNLIGHT === 2){
                    fade(clear_color, [22/255, 28/255, 38/255, 1.0], 100);
                    sun_color = [0.4, 0.4, 0.4];
                    sun_position = [30, 30, 10];
                    gl.uniform3f(u_AmbientLight, 0.5, 0.5, 0.5);
                    SUNLIGHT = 3;
                }
                else if (SUNLIGHT === 3) {
                    sun_color = [0.8, 0.8, 0.8];
                    fade(clear_color, [255/255, 176/255, 165/255, 1.0], 100);
                    sun_position = [-10, 30, 20];
                    gl.uniform3f(u_AmbientLight, 255/255, 125/255, 50/255);
                    SUNLIGHT = 4;
                }
                else{
                    sun_color = [1, 1, 1];
                    fade(clear_color, [196/255, 196/255, 1, 1.0], 100);
                    sun_position = [-30, 10, 15];
                    gl.uniform3f(u_AmbientLight, 1, 1, 1);
                    SUNLIGHT = 1;
                }
                break;
            case "2":
                STREET_LIGHTS = !STREET_LIGHTS;
                let val_r;
                let val_g;
                let val_b;
                if(STREET_LIGHTS){
                    val_r = 200/255;
                    val_g = 200/255;
                    val_b = 200/255;
                }
                else{
                    val_r = 0/255;
                    val_g = 0/255;
                    val_b = 0/255;
                }
                L_COLORS = [
                    val_r, val_g, val_b,
                    val_r, val_g, val_b,
                    val_r, val_g, val_b,
                    sun_color[0], sun_color[1], sun_color[2]
                ];
                break;
            case "3":
                if(gl.getUniform(gl.program, u_UseTextures)){
                    gl.uniform1i(u_UseTextures, 0);
                }
                else{
                    gl.uniform1i(u_UseTextures, 1);
                }
                break;
            case "4":
                DOOR_OPEN = !DOOR_OPEN;
                break;
            case "5":
                extend = true;
        }
        keys.push(event.key);
    });

    window.addEventListener("keyup", (event) => {
        keys.splice(keys.indexOf(event.key));
        extend = false;
    });

    let loop = function (now) {
        now *= 0.01;
        curr = now - prev;
        prev = now;

        if(extend){
            curtain_height += c_var;
            if(curtain_height > 1.4){
                c_var = -Math.abs(c_var);
            }
            else if(curtain_height < 0.1){
                c_var = Math.abs(c_var);
            }
        }

        let rotation_speed = 0.1;
        let movement_speed = 0.1;

        for (let key of keys) {
            switch (key) {
                case "w":
                    z_coord += movement_speed * Math.cos(x_Rot * Math.PI / 180);
                    x_coord += movement_speed * Math.sin(x_Rot * Math.PI / 180);
                    break;

                case "a":
                    z_coord -= movement_speed * Math.sin(x_Rot * Math.PI / 180);
                    x_coord += movement_speed * Math.cos(x_Rot * Math.PI / 180);
                    break;

                case "s":
                    z_coord -= movement_speed * Math.cos((x_Rot) * Math.PI / 180);
                    x_coord -= movement_speed * Math.sin((x_Rot) * Math.PI / 180);
                    break;

                case "d":
                    x_coord -= movement_speed * Math.cos(x_Rot * Math.PI / 180);
                    z_coord += movement_speed * Math.sin(x_Rot * Math.PI / 180);
                    break;

                case "z":
                    y_coord += movement_speed;
                    break;

                case "x":
                    y_coord -= movement_speed;
                    break;

                case "ArrowUp":
                    y_Rot = Math.max(y_Rot - rotation_speed, 1);
                    break;

                case "ArrowDown":
                    y_Rot = Math.min(y_Rot + rotation_speed, 179);
                    break;

                case "ArrowLeft":
                    x_Rot = (x_Rot + rotation_speed) % 360;
                    break;

                case "ArrowRight":
                    x_Rot = (x_Rot - rotation_speed) % 360;
                    break;
            }
        }
        draw(gl, u_ModelMatrix, u_NormalMatrix, u_UseTextures);
        display_HUD();
        requestAnimationFrame(loop)
    };
    loop();
}

function pushMatrix(m) {
    mat_stack.push(new Matrix4(m));
}

function popMatrix() {
    return mat_stack.pop();
}

function draw(gl, u_ModelMatrix, u_NormalMatrix, u_UseTextures) {
    const USE_TEXTURES = gl.getUniform(gl.program, u_UseTextures);

    // ------- Light settings ------
    gl.uniform3fv(u_LightColor, L_COLORS);  // Set the light color (white)
    gl.uniform3fv(u_LightPosition, L_POSITIONS); // Set the light direction (in the world coordinate)

    // ------- Clear settings ------
    gl.clearColor(clear_color[0], clear_color[1], clear_color[2], clear_color[3]);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniform1i(u_UseTextures, 0);

    let g_lookAtX = x_coord + Math.sin(x_Rot * Math.PI / 180) * Math.sin(y_Rot * Math.PI / 180);
    let g_lookAtY = y_coord + Math.cos(y_Rot * Math.PI / 180);
    let g_lookAtZ = z_coord + Math.cos(x_Rot * Math.PI / 180) * Math.sin(y_Rot * Math.PI / 180);

    viewMatrix.setLookAt(x_coord, y_coord, z_coord, g_lookAtX, g_lookAtY, g_lookAtZ, 0, 1, 0);
    gl.uniformMatrix4fv(u_ViewMatrix, false, viewMatrix.elements);
    gl.uniformMatrix4fv(u_ProjMatrix, false, projMatrix.elements);

    display_HUD();

    let n = initVertexBuffers(gl, 204/255, 204/255, 204/255, 1);
    if (n < 0) {
        console.log('Failed to set the vertex information');
        return;
    }
    if(USE_TEXTURES) {
        gl.uniform1i(u_UseTextures, 1);
    }

    gl.activeTexture(gl.TEXTURE2);
    gl.uniform1i(u_Sampler, 2);

    modelMatrix.setTranslate(0, -2.0, 0);
    modelMatrix.rotate(yAngle, 0, 1, 0);
    modelMatrix.rotate(xAngle, 1, 0, 0);
    pushMatrix(modelMatrix);
    modelMatrix.scale(15.0, 0.2, 30.0);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    gl.uniform1i(u_UseTextures, 0);

    // Flat Roof
    pushMatrix(modelMatrix);
    modelMatrix.translate(0, 6.2, 0);
    modelMatrix.rotate(90, 90, 0, 0);
    modelMatrix.scale(6.2, 6.2, 0.2);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    n = initVertexBuffers(gl, 255/255, 180/255, 127/255, 1);

    // 1st floor
    pushMatrix(modelMatrix);
    modelMatrix.translate(0, 0.2, 0);
    modelMatrix.rotate(90, 90, 0, 0);
    modelMatrix.scale(6.18, 6.2, 0.2);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // 2nd floor
    pushMatrix(modelMatrix);
    modelMatrix.translate(0, 3.1, 0);
    modelMatrix.rotate(90, 90, 0, 0);
    modelMatrix.scale(6, 6, 0.2);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    if(USE_TEXTURES) {
        gl.uniform1i(u_UseTextures, 1);
    }
    n = initVertexBuffers(gl, 76/255, 76/255, 76/255, 1);

    // Roof 1
    pushMatrix(modelMatrix);
    modelMatrix.translate(0, 7.2, -1.5);
    modelMatrix.rotate(60, 90, 0, 0);
    modelMatrix.scale(6.2, 3.7, 0.2);
    gl.uniform1i(u_Sampler, 0);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Roof 2
    pushMatrix(modelMatrix);
    modelMatrix.translate(0, 7.2, 1.5);
    modelMatrix.rotate(120, 90, 0, 0);
    modelMatrix.scale(6.2, 3.7, 0.2);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();


    // Roof panel 1a
    pushMatrix(modelMatrix);
    modelMatrix.translate(2.99, 7.0, 0);
    modelMatrix.scale(0.2, 1.9, 0.8);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();


    // Roof panel 1b
    pushMatrix(modelMatrix);
    modelMatrix.translate(-2.99, 7.0, 0);
    modelMatrix.scale(0.2, 1.9, 0.8);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Roof panel 2a
    pushMatrix(modelMatrix);
    modelMatrix.translate(2.99, 6.9, 0.5);
    modelMatrix.scale(0.2, 1.65, 0.4);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Roof panel 2b
    pushMatrix(modelMatrix);
    modelMatrix.translate(-2.99, 6.9, 0.5);
    modelMatrix.scale(0.2, 1.65, 0.4);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Roof panel 2c
    pushMatrix(modelMatrix);
    modelMatrix.translate(2.99, 6.9, -0.5);
    modelMatrix.scale(0.2, 1.65, 0.4);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Roof panel 2d
    pushMatrix(modelMatrix);
    modelMatrix.translate(-2.99, 6.9, -0.5);
    modelMatrix.scale(0.2, 1.65, 0.4);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Roof panel 3a
    pushMatrix(modelMatrix);
    modelMatrix.translate(2.99, 6.9, 0.85);
    modelMatrix.scale(0.2, 1.3, 0.4);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Roof panel 3b
    pushMatrix(modelMatrix);
    modelMatrix.translate(-2.99, 6.9, 0.85);
    modelMatrix.scale(0.2, 1.3, 0.4);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Roof panel 3c
    pushMatrix(modelMatrix);
    modelMatrix.translate(2.99, 6.9, -0.85);
    modelMatrix.scale(0.2, 1.3, 0.4);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Roof panel 3d
    pushMatrix(modelMatrix);
    modelMatrix.translate(-2.99, 6.9, -0.85);
    modelMatrix.scale(0.2, 1.3, 0.4);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Roof panel 4a
    pushMatrix(modelMatrix);
    modelMatrix.translate(2.99, 6.8, 1.2);
    modelMatrix.scale(0.2, 1.1, 0.4);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Roof panel 4b
    pushMatrix(modelMatrix);
    modelMatrix.translate(-2.99, 6.8, 1.2);
    modelMatrix.scale(0.2, 1.1, 0.4);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Roof panel 4c
    pushMatrix(modelMatrix);
    modelMatrix.translate(2.99, 6.8, -1.2);
    modelMatrix.scale(0.2, 1.1, 0.4);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Roof panel 4d
    pushMatrix(modelMatrix);
    modelMatrix.translate(-2.99, 6.8, -1.2);
    modelMatrix.scale(0.2, 1.1, 0.4);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Roof panel 5a
    pushMatrix(modelMatrix);
    modelMatrix.translate(2.99, 6.7, 1.5);
    modelMatrix.scale(0.2, 0.9, 0.4);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Roof panel 5b
    pushMatrix(modelMatrix);
    modelMatrix.translate(-2.99, 6.7, 1.5);
    modelMatrix.scale(0.2, 0.9, 0.4);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Roof panel 5a
    pushMatrix(modelMatrix);
    modelMatrix.translate(2.99, 6.7, -1.5);
    modelMatrix.scale(0.2, 0.9, 0.4);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Roof panel 5b
    pushMatrix(modelMatrix);
    modelMatrix.translate(-2.99, 6.7, -1.5);
    modelMatrix.scale(0.2, 0.9, 0.4);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Roof panel 6a
    pushMatrix(modelMatrix);
    modelMatrix.translate(2.99, 6.6, 1.8);
    modelMatrix.scale(0.2, 0.75, 0.4);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Roof panel 6b
    pushMatrix(modelMatrix);
    modelMatrix.translate(-2.99, 6.6, 1.8);
    modelMatrix.scale(0.2, 0.75, 0.4);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Roof panel 6c
    pushMatrix(modelMatrix);
    modelMatrix.translate(2.99, 6.6, -1.8);
    modelMatrix.scale(0.2, 0.75, 0.4);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Roof panel 6d
    pushMatrix(modelMatrix);
    modelMatrix.translate(-2.99, 6.6, -1.8);
    modelMatrix.scale(0.2, 0.75, 0.4);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Roof panel 7a
    pushMatrix(modelMatrix);
    modelMatrix.translate(2.99, 6.4, 2.2);
    modelMatrix.scale(0.2, 0.77, 0.4);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Roof panel 7b
    pushMatrix(modelMatrix);
    modelMatrix.translate(-2.99, 6.4, 2.2);
    modelMatrix.scale(0.2, 0.77, 0.4);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Roof panel 7c
    pushMatrix(modelMatrix);
    modelMatrix.translate(2.99, 6.4, -2.2);
    modelMatrix.scale(0.2, 0.77, 0.4);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Roof panel 7d
    pushMatrix(modelMatrix);
    modelMatrix.translate(-2.99, 6.4, -2.2);
    modelMatrix.scale(0.2, 0.77, 0.4);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Roof panel 8a
    pushMatrix(modelMatrix);
    modelMatrix.translate(2.99, 6.3, 2.55);
    modelMatrix.scale(0.2, 0.6, 0.3);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Roof panel 8b
    pushMatrix(modelMatrix);
    modelMatrix.translate(-2.99, 6.3, 2.55);
    modelMatrix.scale(0.2, 0.6, 0.3);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Roof panel 8c
    pushMatrix(modelMatrix);
    modelMatrix.translate(2.99, 6.3, -2.55);
    modelMatrix.scale(0.2, 0.6, 0.3);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Roof panel 8d
    pushMatrix(modelMatrix);
    modelMatrix.translate(-2.99, 6.3, -2.55);
    modelMatrix.scale(0.2, 0.6, 0.3);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Roof panel 9a
    pushMatrix(modelMatrix);
    modelMatrix.translate(2.99, 6.3, 2.7);
    modelMatrix.scale(0.2, 0.3, 0.3);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Roof panel 9b
    pushMatrix(modelMatrix);
    modelMatrix.translate(-2.99, 6.3, 2.7);
    modelMatrix.scale(0.2, 0.3, 0.3);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Roof panel 9c
    pushMatrix(modelMatrix);
    modelMatrix.translate(2.99, 6.3, -2.7);
    modelMatrix.scale(0.2, 0.3, 0.3);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Roof panel 9d
    pushMatrix(modelMatrix);
    modelMatrix.translate(-2.99, 6.3, -2.7);
    modelMatrix.scale(0.2, 0.3, 0.3);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Outer Roof 1
    pushMatrix(modelMatrix);
    modelMatrix.translate(1.5, 3, -6.5);
    modelMatrix.rotate(90, 90, 0, 0);
    modelMatrix.scale(3.1, 7, 0.2);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Outer Roof 3
    pushMatrix(modelMatrix);
    modelMatrix.translate(-1.5, 3, -8.5);
    modelMatrix.rotate(90, 90, 0, 0);
    modelMatrix.scale(3.1, 3, 0.2);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Outer roof 1
    pushMatrix(modelMatrix);
    modelMatrix.translate(0, 3.5, -9.3);

    modelMatrix.rotate(60, 1, 0, 0);
    modelMatrix.scale(6.3, 2, 0.2);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();
    //
    // Outer roof 2
    pushMatrix(modelMatrix);
    modelMatrix.translate(0, 3.5, -7.7);
    modelMatrix.rotate(120, 90, 0, 0);
    modelMatrix.scale(6.3, 2, 0.2);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();
    //
    // Outer roof 3
    pushMatrix(modelMatrix);
    modelMatrix.rotate(60, 0, 0, 1);
    modelMatrix.translate(4.2, -0.35, -5.9);
    modelMatrix.scale(0.2, 1.5, 5.6);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Outer roof 4
    pushMatrix(modelMatrix);
    modelMatrix.rotate(120, 0, 0, 1);
    modelMatrix.translate(2.8, -2.0, -5.9);
    modelMatrix.scale(0.2, 1.5, 5.6);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Outer roof 5
    pushMatrix(modelMatrix);
    modelMatrix.translate(1.4, 3.8, -5.9);
    modelMatrix.scale(1, 0.2, 5.6);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Outer roof panel 1a
    pushMatrix(modelMatrix);
    modelMatrix.translate(2.98, 3.45, -8.5);
    modelMatrix.scale(0.2, 0.8, 0.4);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Outer roof panel 1ba
    pushMatrix(modelMatrix);
    modelMatrix.translate(-2.98, 3.45, -8.5);
    modelMatrix.scale(0.2, 0.8, 0.4);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Outer roof panel 2a
    pushMatrix(modelMatrix);
    modelMatrix.translate(2.98, 3.4, -8.3);
    modelMatrix.scale(0.2, 0.6, 0.4);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Outer roof panel 2b
    pushMatrix(modelMatrix);
    modelMatrix.translate(2.98, 3.4, -8.7);
    modelMatrix.scale(0.2, 0.6, 0.4);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Outer roof panel 2c
    pushMatrix(modelMatrix);
    modelMatrix.translate(-3.00, 3.4, -8.3);
    modelMatrix.scale(0.2, 0.6, 0.4);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Outer roof panel 2d
    pushMatrix(modelMatrix);
    modelMatrix.translate(-2.98, 3.4, -8.7);
    modelMatrix.scale(0.2, 0.6, 0.4);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Outer roof panel 3a
    pushMatrix(modelMatrix);
    modelMatrix.translate(2.98, 3.35, -8);
    modelMatrix.scale(0.2, 0.5, 0.4);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Outer roof panel 3b
    pushMatrix(modelMatrix);
    modelMatrix.translate(2.98, 3.35, -9);
    modelMatrix.scale(0.2, 0.5, 0.4);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Outer roof panel 3c
    pushMatrix(modelMatrix);
    modelMatrix.translate(-2.98, 3.35, -8);
    modelMatrix.scale(0.2, 0.5, 0.4);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Outer roof panel 3d
    pushMatrix(modelMatrix);
    modelMatrix.translate(-2.98, 3.35, -9);
    modelMatrix.scale(0.2, 0.5, 0.4);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Outer roof panel 4a
    pushMatrix(modelMatrix);
    modelMatrix.translate(2.98, 3.2, -7.7);
    modelMatrix.scale(0.2, 0.5, 0.3);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Outer roof panel 4b
    pushMatrix(modelMatrix);
    modelMatrix.translate(2.98, 3.2, -9.3);
    modelMatrix.scale(0.2, 0.5, 0.3);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Outer roof panel 4c
    pushMatrix(modelMatrix);
    modelMatrix.translate(-2.98, 3.2, -7.7);
    modelMatrix.scale(0.2, 0.5, 0.3);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Outer roof panel 4d
    pushMatrix(modelMatrix);
    modelMatrix.translate(-2.98, 3.2, -9.3);
    modelMatrix.scale(0.2, 0.5, 0.3);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Outer roof panel 5a
    pushMatrix(modelMatrix);
    modelMatrix.translate(2.98, 3.1, -7.4);
    modelMatrix.scale(0.2, 0.4, 0.3);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Outer roof panel 5b
    pushMatrix(modelMatrix);
    modelMatrix.translate(2.98, 3.1, -9.6);
    modelMatrix.scale(0.2, 0.4, 0.3);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Outer roof panel 5c
    pushMatrix(modelMatrix);
    modelMatrix.translate(-2.98, 3.1, -7.4);
    modelMatrix.scale(0.2, 0.4, 0.3);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Outer roof panel 5d
    pushMatrix(modelMatrix);
    modelMatrix.translate(-2.98, 3.1, -9.6);
    modelMatrix.scale(0.2, 0.4, 0.3);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Outer roof panel 6a
    pushMatrix(modelMatrix);
    modelMatrix.translate(2.98, 3, -7.1);
    modelMatrix.scale(0.2, 0.2, 0.2);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Outer roof panel 6b
    pushMatrix(modelMatrix);
    modelMatrix.translate(2.98, 3, -9.9);
    modelMatrix.scale(0.2, 0.2, 0.2);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Outer roof panel 6c
    pushMatrix(modelMatrix);
    modelMatrix.translate(-2.98, 3, -7.1);
    modelMatrix.scale(0.2, 0.2, 0.2);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Outer roof panel 6d
    pushMatrix(modelMatrix);
    modelMatrix.translate(-2.98, 3, -9.9);
    modelMatrix.scale(0.2, 0.2, 0.2);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    gl.uniform1i(u_UseTextures, 0);

    n = initVertexBuffers(gl, 160/255, 106/255, 77/255, 1);
    // Decal 1
    pushMatrix(modelMatrix);
    modelMatrix.translate(0, 6.1, 3.2);
    modelMatrix.scale(0.15, 0.2, 0.15);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Decal 2
    pushMatrix(modelMatrix);
    modelMatrix.translate(0.75, 6.1, 3.2);
    modelMatrix.scale(0.15, 0.2, 0.15);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Decal 3
    pushMatrix(modelMatrix);
    modelMatrix.translate(1.5, 6.1, 3.2);
    modelMatrix.scale(0.15, 0.2, 0.15);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Decal 4
    pushMatrix(modelMatrix);
    modelMatrix.translate(2.25, 6.1, 3.2);
    modelMatrix.scale(0.15, 0.2, 0.15);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Decal 5
    pushMatrix(modelMatrix);
    modelMatrix.translate(3, 6.1, 3.2);
    modelMatrix.scale(0.15, 0.2, 0.15);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Decal 6
    pushMatrix(modelMatrix);
    modelMatrix.translate(-0.75, 6.1, 3.2);
    modelMatrix.scale(0.15, 0.2, 0.15);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Decal 7
    pushMatrix(modelMatrix);
    modelMatrix.translate(-1.5, 6.1, 3.2);
    modelMatrix.scale(0.15, 0.2, 0.15);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Decal 8
    pushMatrix(modelMatrix);
    modelMatrix.translate(-2.25, 6.1, 3.2);
    modelMatrix.scale(0.15, 0.2, 0.15);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Decal 9
    pushMatrix(modelMatrix);
    modelMatrix.translate(-3, 6.1, 3.2);
    modelMatrix.scale(0.15, 0.2, 0.15);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    if(USE_TEXTURES) {
        gl.uniform1i(u_UseTextures, 1);
    }

    gl.uniform1i(u_Sampler, 1);

    // Front House wall 1
    pushMatrix(modelMatrix);
    modelMatrix.translate(-2.43, 3.1, 3);
    modelMatrix.scale(1.3, 6, 0.2);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Front House wall 2
    pushMatrix(modelMatrix);
    modelMatrix.translate(-1.2, 5.8, 3);
    modelMatrix.scale(1.2, 0.6, 0.2);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Front House wall 3
    pushMatrix(modelMatrix);
    modelMatrix.translate(-1.2, 3.5, 3);
    modelMatrix.scale(1.2, 1.4, 0.2);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Front House wall 4
    pushMatrix(modelMatrix);
    modelMatrix.translate(-1.2, 0.8, 3);
    modelMatrix.scale(1.2, 1.4, 0.2);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Front House wall 5
    pushMatrix(modelMatrix);
    modelMatrix.translate(0.1, 3.1, 3);
    modelMatrix.scale(1.4, 6, 0.2);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Front House wall 6
    pushMatrix(modelMatrix);
    modelMatrix.translate(1.3, 4.49, 3);
    modelMatrix.scale(1, 3.22, 0.2);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Front House wall 7
    pushMatrix(modelMatrix);
    modelMatrix.translate(2.43, 3.1, 3);
    modelMatrix.scale(1.3, 6, 0.2);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Back House wall
    pushMatrix(modelMatrix);
    modelMatrix.translate(0, 3.1, -3);
    modelMatrix.scale(6, 6, 0.2);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Chimney
    pushMatrix(modelMatrix);
    modelMatrix.translate(-2.5, 7.5, 1);
    modelMatrix.scale(1, 2, 1.6);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Left House wall
    pushMatrix(modelMatrix);
    modelMatrix.translate(3, 3.1, 0);
    modelMatrix.rotate(90, 0, 1, 0);
    modelMatrix.scale(6.2, 6, 0.2);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Right House wall
    pushMatrix(modelMatrix);
    modelMatrix.translate(-3, 3.1, 0);
    //                 x  height y
    modelMatrix.rotate(90, 0, 1, 0);
    modelMatrix.scale(6.2, 6, 0.2);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Right Lower Wall
    pushMatrix(modelMatrix);
    modelMatrix.translate(3, 1.6, -6.5);
    modelMatrix.rotate(90, 0, 1, 0);
    modelMatrix.scale(7, 3, 0.2);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Left Lower Wall
    pushMatrix(modelMatrix);
    modelMatrix.translate(0, 1.6, -6.5);
    modelMatrix.rotate(90, 0, 1, 0);
    modelMatrix.scale(7, 3, 0.2);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Back room wall
    pushMatrix(modelMatrix);
    modelMatrix.translate(0.1, 1.6, -10);
    modelMatrix.scale(6, 3, 0.2);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Outer floor
    pushMatrix(modelMatrix);
    modelMatrix.translate(1.5, 0.2, -6.5);
    modelMatrix.rotate(90, 90, 0, 0);
    modelMatrix.scale(3.1, 7, 0.2);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Outer Roof 1
    pushMatrix(modelMatrix);
    modelMatrix.translate(1.5, 3, -6.5);
    modelMatrix.rotate(90, 90, 0, 0);
    modelMatrix.scale(3.1, 7, 0.2);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Frans window
    pushMatrix(modelMatrix);
    modelMatrix.translate(-1.4, 1.6, -7.1);
    modelMatrix.scale(3.1, 3, 0.02);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Right Lower Wall
    pushMatrix(modelMatrix);
    modelMatrix.translate(-3, 1.6, -8.5);
    modelMatrix.rotate(90, 0, 1, 0);
    modelMatrix.scale(3.2, 3, 0.2);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Outer Roof 3
    pushMatrix(modelMatrix);
    modelMatrix.translate(-1.5, 3, -8.5);
    modelMatrix.rotate(90, 90, 0, 0);
    modelMatrix.scale(3.1, 3, 0.2);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Outer Floor 3
    pushMatrix(modelMatrix);
    modelMatrix.translate(-1.5, 1.5, -8.5);
    modelMatrix.rotate(90, 90, 0, 0);
    modelMatrix.scale(3.1, 3, 0.2);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    gl.uniform1i(u_UseTextures, 0);
    gl.uniform1i(u_UseTextures, USE_TEXTURES);

    if(USE_TEXTURES) {
        gl.uniform1i(u_UseTextures, 1);
    }

    gl.activeTexture(gl.TEXTURE3);
    gl.uniform1i(u_Sampler, 3);

    n = initVertexBuffers(gl, 252/255, 245/255, 237/255, 1);

    // Pavement 1
    pushMatrix(modelMatrix);
    modelMatrix.translate(0, 0.15, 4.8);
    modelMatrix.rotate(90, 90, 0, 0);
    modelMatrix.scale(15, 3.5, 0.2);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Pavement 2
    pushMatrix(modelMatrix);
    modelMatrix.translate(0, 0.15, 13.3);
    modelMatrix.rotate(90, 90, 0, 0);
    modelMatrix.scale(15, 3.5, 0.2);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    gl.uniform1i(u_UseTextures, 0);

    n = initVertexBuffers(gl, 20/255, 20/255, 20/255, 1);

    // Right drainpipe
    pushMatrix(modelMatrix);
    modelMatrix.translate(2.6, 3.1, 3.1);
    modelMatrix.scale(0.1, 6, 0.1);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Top drainpipe
    pushMatrix(modelMatrix);
    modelMatrix.translate(0, 6.2, 3.2);
    modelMatrix.scale(6.2, 0.2, 0.2);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    if(USE_TEXTURES) {
        gl.uniform1i(u_UseTextures, 1);
    }

    gl.activeTexture(gl.TEXTURE4);
    gl.uniform1i(u_Sampler, 4);
    n = initVertexBuffers(gl, 130/255, 130/255, 130/255, 1);

    // Pavement 3
    pushMatrix(modelMatrix);
    modelMatrix.translate(0, 0.15, -5.98);
    modelMatrix.rotate(90, 90, 0, 0);
    modelMatrix.scale(15, 18, 0.2);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    gl.uniform1i(u_UseTextures, 0);
    n = initVertexBuffers(gl, 255/255, 255/255, 255/255, 1);

    // Frans window top
    pushMatrix(modelMatrix);
    modelMatrix.translate(-1.5, 2.55, -6.92);
    modelMatrix.scale(2.2, 0.3, 0.1);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Frans window thin
    pushMatrix(modelMatrix);
    modelMatrix.translate(-1.5, 1.8, -6.9);
    modelMatrix.scale(0.1, 1.6, 0.1);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Frans window thin right
    pushMatrix(modelMatrix);
    modelMatrix.translate(-0.5, 1.8, -6.9);
    modelMatrix.scale(0.1, 1.6, 0.1);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Frans window thin left
    pushMatrix(modelMatrix);
    modelMatrix.translate(-2.5, 1.8, -6.9);
    modelMatrix.scale(0.1, 1.6, 0.1);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Frans window bottom
    pushMatrix(modelMatrix);
    modelMatrix.translate(-1.5, 1.1, -6.92);
    modelMatrix.scale(2.2, 0.2, 0.1);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    n = initVertexBuffers(gl, 130/255, 130/255, 130/255, 0.9);

    // Frans window
    pushMatrix(modelMatrix);
    modelMatrix.translate(-1.5, 1.8, -6.92);
    modelMatrix.scale(1.8, 1.1, 0.1);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // blind colour
    n = initVertexBuffers(gl, 56/255, 51/255, 76/255, 1);

    // // Blinds 1
    pushMatrix(modelMatrix);
    modelMatrix.translate(-1.2, 5.5-(c_var/2), 3.0);
    modelMatrix.scale(1.2, curtain_height + c_var, 0.1);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // // Blinds 2
    pushMatrix(modelMatrix);
    modelMatrix.translate(-1.2, 2.8-(c_var/2), 3.0);
    modelMatrix.scale(1.2, curtain_height + c_var, 0.1);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    n = initVertexBuffers(gl, 14/255, 33/255, 13/255, 1);
    gl.activeTexture(gl.TEXTURE6);
    gl.uniform1i(u_Sampler, 6);

    if(USE_TEXTURES) {
        gl.uniform1i(u_UseTextures, 1);
    }

    // Front Door
    if(DOOR_OPEN){
        pushMatrix(modelMatrix);
        modelMatrix.translate(1.7, 1.4, 3.5);
        modelMatrix.rotate(90, 0, 1, 0);
        modelMatrix.scale(0.9, 2.2, 0.1);
        drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
        modelMatrix = popMatrix();
    }
    else {
        pushMatrix(modelMatrix);
        modelMatrix.translate(1.3, 1.4, 3.05);
        modelMatrix.scale(1, 2.2, 0.1);
        drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
        modelMatrix = popMatrix();
    }
    gl.uniform1i(u_UseTextures, 0);

    n = initVertexBuffers(gl, 255/255, 255/255, 255/255, 1);

    // Front Door Ledge
    pushMatrix(modelMatrix);
    modelMatrix.translate(1.3, 3.1, 3.08);
    modelMatrix.scale(1.7, 0.3, 0.1);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Front Window Bottom Ledge wall
    pushMatrix(modelMatrix);
    modelMatrix.translate(-1.2, 1.3, 3.08);
    modelMatrix.scale(1.7, 0.2, 0.1);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Front Window Top section
    pushMatrix(modelMatrix);
    modelMatrix.translate(-1.2, 2.85, 3.08);
    modelMatrix.scale(1.3, 0.1, 0.2);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Front Door Top section
    pushMatrix(modelMatrix);
    modelMatrix.translate(1.3, 2.52, 3.08);
    modelMatrix.scale(0.9, 0.05, 0.1);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Front Door Upper Top section
    pushMatrix(modelMatrix);
    modelMatrix.translate(1.3, 2.92, 3.08);
    modelMatrix.scale(0.9, 0.1, 0.1);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Front Window Bottom section
    pushMatrix(modelMatrix);
    modelMatrix.translate(-1.2, 1.45, 3.08);
    modelMatrix.scale(1.3, 0.1, 0.1);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Front Window mid section
    pushMatrix(modelMatrix);
    modelMatrix.translate(-1.2, 2.1, 3.08);
    modelMatrix.scale(1.3, 0.1, 0.1);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Front Top Window Cross section
    pushMatrix(modelMatrix);
    modelMatrix.translate(-1.2, 2.55, 3.08);
    modelMatrix.scale(0.05, 0.8, 0.05);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Front Window Left section
    pushMatrix(modelMatrix);
    modelMatrix.translate(-1.8, 2.15, 3.08);
    modelMatrix.scale(0.1, 1.6, 0.1);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Left door section
    pushMatrix(modelMatrix);
    modelMatrix.translate(1.8, 1.6, 3.08);
    modelMatrix.scale(0.1, 2.8, 0.1);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Left door section
    pushMatrix(modelMatrix);
    modelMatrix.translate(0.8, 1.6, 3.08);
    modelMatrix.scale(0.1, 2.8, 0.1);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Front Window Right section
    pushMatrix(modelMatrix);
    modelMatrix.translate(-0.5, 2.15, 3.08);
    modelMatrix.scale(0.1, 1.6, 0.1);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Front Top Window Ledge wall
    pushMatrix(modelMatrix);
    modelMatrix.translate(-1.2, 5.8, 3.08);
    modelMatrix.scale(1.7, 0.4, 0.1);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Front Top Window Bottom Ledge wall
    pushMatrix(modelMatrix);
    modelMatrix.translate(-1.2, 4, 3.08);
    modelMatrix.scale(1.7, 0.2, 0.1);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Front Top Window Top section
    pushMatrix(modelMatrix);
    modelMatrix.translate(-1.2, 5.55, 3.08);
    modelMatrix.scale(1.3, 0.1, 0.2);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Front Top Window Left section
    pushMatrix(modelMatrix);
    modelMatrix.translate(-1.8, 4.85, 3.08);
    modelMatrix.scale(0.1, 1.6, 0.1);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Front Top Window Right section
    pushMatrix(modelMatrix);
    modelMatrix.translate(-0.5, 4.85, 3.08);
    modelMatrix.scale(0.1, 1.6, 0.1);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Front Top Window Mid section
    pushMatrix(modelMatrix);
    modelMatrix.translate(-1.2, 4.8, 3.08);
    modelMatrix.scale(1.3, 0.1, 0.1);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Front Top Window Cross section
    pushMatrix(modelMatrix);
    modelMatrix.translate(-1.2, 5.2, 3.08);
    modelMatrix.scale(0.05, 0.8, 0.05);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Front Top Window Bottom section
    pushMatrix(modelMatrix);
    modelMatrix.translate(-1.2, 4.15, 3.08);
    modelMatrix.scale(1.3, 0.1, 0.1);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Front Window Ledge wall
    pushMatrix(modelMatrix);
    modelMatrix.translate(-1.2, 3.1, 3.08);
    modelMatrix.scale(1.7, 0.4, 0.1);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    n = initVertexBuffers(gl, 163/255, 109/255, 214/255, 1);

    // Top room wall colour
    pushMatrix(modelMatrix);
    modelMatrix.translate(0, 4.7, -2.7);
    modelMatrix.scale(6, 3, 0.2);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    pushMatrix(modelMatrix);
    modelMatrix.translate(2.9, 4.7, 0);
    modelMatrix.scale(0.02, 3, 6);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    pushMatrix(modelMatrix);
    modelMatrix.translate(-2.9, 4.7, 0);
    modelMatrix.scale(0.02, 3, 6);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    n = initVertexBuffers(gl, 214/255, 216/255, 219/255, 1);
    gl.activeTexture(gl.TEXTURE5);
    gl.uniform1i(u_Sampler, 5);

    if(USE_TEXTURES) {
        gl.uniform1i(u_UseTextures, 1);
    }

    // Bottom room wall colour
    pushMatrix(modelMatrix);
    modelMatrix.translate(0, 1.7, -2.7);
    modelMatrix.scale(6, 3, 0.2);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    pushMatrix(modelMatrix);
    modelMatrix.translate(2.9, 1.7, 0);
    modelMatrix.scale(0.02, 3, 6);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    pushMatrix(modelMatrix);
    modelMatrix.translate(-2.9, 1.7, 0);
    modelMatrix.scale(0.02, 3, 6);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    gl.uniform1i(u_UseTextures, 0);

    // this controls the body color of the car
    n = initVertexBuffers(gl, car_color[0], car_color[1], car_color[2], 1);

    // Front main trim piece
    pushMatrix(modelMatrix);
    modelMatrix.translate(1.55+x_inc, 1.57, 9.95+z_inc);
    modelMatrix.rotate(90, 0, 1, 0);
    modelMatrix.scale(2, 0.1, 0.2);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Right-large side car piece
    pushMatrix(modelMatrix);
    modelMatrix.translate(x_inc, 1.6, 10.9+z_inc);
    modelMatrix.rotate(125, 1, 0, 0);
    modelMatrix.scale(3, 0.3, 0.1);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Left-large side car piece
    pushMatrix(modelMatrix);
    modelMatrix.translate(x_inc, 1.6, 9+z_inc);
    modelMatrix.rotate(55, 1, 0, 0);
    modelMatrix.scale(3, 0.3, 0.1);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Right-large main side car piece
    pushMatrix(modelMatrix);
    modelMatrix.translate(x_inc, 1.35, 11+z_inc);
    modelMatrix.rotate(180, 1, 0, 0);
    modelMatrix.scale(3, 0.4, 0.1);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Car bottom
    pushMatrix(modelMatrix);
    modelMatrix.translate(x_inc, 1, 9.95+z_inc);
    modelMatrix.rotate(90, 0, 1, 0);
    modelMatrix.scale(2.5, 0.4, 3.8);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Right-large main side car piece
    pushMatrix(modelMatrix);
    modelMatrix.translate(x_inc, 1.35, 8.9+z_inc);
    modelMatrix.rotate(180, 1, 0, 0);
    modelMatrix.scale(3, 0.4, 0.1);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Back main car piece
    pushMatrix(modelMatrix);
    modelMatrix.translate(-1.7+x_inc, 1.35, 9.95+z_inc);
    modelMatrix.rotate(90, 0, 1, 0);
    modelMatrix.scale(2.2, 0.4, 0.6);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Back main trim piece
    pushMatrix(modelMatrix);
    modelMatrix.translate(-1.55+x_inc, 1.57, 9.95+z_inc);
    modelMatrix.rotate(90, 0, 1, 0);
    modelMatrix.scale(2, 0.1, 0.2);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Front main car piece
    pushMatrix(modelMatrix);
    modelMatrix.translate(1.8+x_inc, 1.35, 9.95+z_inc);
    modelMatrix.rotate(90, 0, 1, 0);
    modelMatrix.scale(2.2, 0.4, 0.8);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    n = initVertexBuffers(gl, 100/255, 100/255, 100/255, 1);

    // Wheel part 1 car
    pushMatrix(modelMatrix);
    modelMatrix.translate(1.45+x_inc, 0.6, 10.9+z_inc);
    modelMatrix.rotate(90, 0, 1, 0);
    modelMatrix.rotate(wheel_rot, 1, 0, 0);
    modelMatrix.scale(0.4, 0.8, 0.8);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Wheel part 2 car
    pushMatrix(modelMatrix);
    modelMatrix.translate(1.45+x_inc, 0.6, 10.9+z_inc);
    modelMatrix.rotate(90, 0, 1, 0);
    modelMatrix.rotate(wheel_rot+30, 1, 0, 0);
    modelMatrix.scale(0.4, 0.8, 0.8);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Wheel part 3 car
    pushMatrix(modelMatrix);
    modelMatrix.translate(1.45+x_inc, 0.6, 10.9+z_inc);
    modelMatrix.rotate(90, 0, 1, 0);
    modelMatrix.rotate(wheel_rot+60, 1, 0, 0);
    modelMatrix.scale(0.4, 0.8, 0.8);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Wheel part 1 car
    pushMatrix(modelMatrix);
    modelMatrix.translate(-1.45+x_inc, 0.6, 10.9+z_inc);
    modelMatrix.rotate(90, 0, 1, 0);
    modelMatrix.rotate(wheel_rot, 1, 0, 0);
    modelMatrix.scale(0.4, 0.8, 0.8);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Wheel part 2 car
    pushMatrix(modelMatrix);
    modelMatrix.translate(-1.45+x_inc, 0.6, 10.9+z_inc);
    modelMatrix.rotate(90, 0, 1, 0);
    modelMatrix.rotate(wheel_rot+30, 1, 0, 0);
    modelMatrix.scale(0.4, 0.8, 0.8);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Wheel part 3 car
    pushMatrix(modelMatrix);
    modelMatrix.translate(-1.45+x_inc, 0.6, 10.9+z_inc);
    modelMatrix.rotate(90, 0, 1, 0);
    modelMatrix.rotate(wheel_rot+60, 1, 0, 0);
    modelMatrix.scale(0.4, 0.8, 0.8);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Wheel part 1 car
    pushMatrix(modelMatrix);
    modelMatrix.translate(1.45+x_inc, 0.6, 9.1+z_inc);
    modelMatrix.rotate(90, 0, 1, 0);
    modelMatrix.rotate(wheel_rot, 1, 0, 0);
    modelMatrix.scale(0.4, 0.8, 0.8);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Wheel part 2 car
    pushMatrix(modelMatrix);
    modelMatrix.translate(1.45+x_inc, 0.6, 9.1+z_inc);
    modelMatrix.rotate(90, 0, 1, 0);
    modelMatrix.rotate(wheel_rot+30, 1, 0, 0);
    modelMatrix.scale(0.4, 0.8, 0.8);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Wheel part 3 car
    pushMatrix(modelMatrix);
    modelMatrix.translate(1.45+x_inc, 0.6, 9.1+z_inc);
    modelMatrix.rotate(90, 0, 1, 0);
    modelMatrix.rotate(wheel_rot+60, 1, 0, 0);
    modelMatrix.scale(0.4, 0.8, 0.8);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Wheel part 1 car
    pushMatrix(modelMatrix);
    modelMatrix.translate(-1.45+x_inc, 0.6, 9.1+z_inc);
    modelMatrix.rotate(90, 0, 1, 0);
    modelMatrix.rotate(wheel_rot, 1, 0, 0);
    modelMatrix.scale(0.4, 0.8, 0.8);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Wheel part 2 car
    pushMatrix(modelMatrix);
    modelMatrix.translate(-1.45+x_inc, 0.6, 9.1+z_inc);
    modelMatrix.rotate(90, 0, 1, 0);
    modelMatrix.rotate(wheel_rot+30, 1, 0, 0);
    modelMatrix.scale(0.4, 0.8, 0.8);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Wheel part 3 car
    pushMatrix(modelMatrix);
    modelMatrix.translate(-1.45+x_inc, 0.6, 9.1+z_inc);
    modelMatrix.rotate(90, 0, 1, 0);
    modelMatrix.rotate(wheel_rot+60, 1, 0, 0);
    modelMatrix.scale(0.4, 0.8, 0.8);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    n = initVertexBuffers(gl, 0/255, 0/255, 0/255, 0.6);

    // Left-long car piece
    pushMatrix(modelMatrix);
    modelMatrix.translate(x_inc, 1.7, 9.2+z_inc);
    modelMatrix.scale(3.2, 0.1, 0.1);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Right-long car piece
    pushMatrix(modelMatrix);
    modelMatrix.translate(x_inc, 1.7, 10.8+z_inc);
    modelMatrix.scale(3.2, 0.1, 0.1);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Right-Left car piece
    pushMatrix(modelMatrix);
    modelMatrix.translate(-1.45+x_inc, 2, 9.4+z_inc);
    modelMatrix.rotate(30, 1, 0, 0);
    modelMatrix.scale(0.1, 0.7, 0.1);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Back long car piece
    pushMatrix(modelMatrix);
    modelMatrix.translate(-1.6+x_inc, 1.7, 10+z_inc);
    modelMatrix.scale(0.1, 0.1, 1.7);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Front long car piece
    pushMatrix(modelMatrix);
    modelMatrix.translate(1.6+x_inc, 1.7, 10+z_inc);
    modelMatrix.scale(0.1, 0.1, 1.7);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Right-mid car piece
    pushMatrix(modelMatrix);
    modelMatrix.translate(x_inc, 2, 10.6+z_inc);
    modelMatrix.rotate(150, 1, 0, 0);
    modelMatrix.scale(0.3, 0.7, 0.1);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Right-mid centre car piece
    pushMatrix(modelMatrix);
    modelMatrix.translate(x_inc, 2, 10.6+z_inc);
    modelMatrix.rotate(150, 1, 0, 0);
    modelMatrix.scale(0.1, 0.7, 0.15);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Left-Right car piece
    pushMatrix(modelMatrix);
    modelMatrix.translate(1.45+x_inc, 2, 9.4+z_inc);
    modelMatrix.rotate(30, 1, 0, 0);
    modelMatrix.scale(0.1, 0.7, 0.1);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Left-mid car piece
    pushMatrix(modelMatrix);
    modelMatrix.translate(x_inc, 2, 9.4+z_inc);
    modelMatrix.rotate(30, 1, 0, 0);
    modelMatrix.scale(0.3, 0.7, 0.1);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    //Right-right car piece
    pushMatrix(modelMatrix);
    modelMatrix.translate(1.45+x_inc, 2, 10.6+z_inc);
    modelMatrix.rotate(150, 1, 0, 0);
    modelMatrix.scale(0.1, 0.7, 0.1);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Left-right car piece
    pushMatrix(modelMatrix);
    modelMatrix.translate(-1.45+x_inc, 2, 10.6+z_inc);
    modelMatrix.rotate(150, 1, 0, 0);
    modelMatrix.scale(0.1, 0.7, 0.1);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    //Top car piece
    pushMatrix(modelMatrix);
    modelMatrix.translate(x_inc, 2.3, 10+z_inc);
    modelMatrix.rotate(90, 1, 0, 0);
    modelMatrix.scale(3, 1, 0.05);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Car Model
    if(car) {
        wheel_rot += 8;
        wheel_rot %= 360;

        x_inc += 0.4;
        if (x_inc > 15) {
            x_inc = 1000;
            car = false;
        }
    }
    else{
        // Set car properties
        if(Math.random() < 0.02){
            let choice = Math.floor(Math.random() * 5);
            switch(choice){
                case 0:
                    car_color = [15/255, 10/255, 153/255];
                    break;
                case 1:
                    car_color = [239/255, 52/255, 183/255];
                    break;
                case 2:
                    car_color = [255/255, 197/255, 7/255];
                    break;
                case 3:
                    car_color = [255/255, 7/255, 7/255];
                    break;
                case 4:
                    car_color = [131/255, 7/255, 255/255];
                    break;
            }
            car = true;
            x_inc = -15;
            if(Math.random() < 0.333){
                const horn = document.getElementById('horn');
                horn.play();
            }
        }
    }

    n = initVertexBuffers(gl, 100/255, 100/255, 100/255, 0.9);

    // Street Light base
    pushMatrix(modelMatrix);
    modelMatrix.translate(6, 4, 4);
    modelMatrix.scale(0.2, 8, 0.2);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Street Light Neck
    pushMatrix(modelMatrix);
    modelMatrix.translate(6, 7.9, 4.5);
    modelMatrix.scale(0.2, 0.2, 1);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Street Light Neck
    pushMatrix(modelMatrix);
    modelMatrix.translate(0, 7.9, 14);
    modelMatrix.scale(0.2, 0.2, 1);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Street Light base
    pushMatrix(modelMatrix);
    modelMatrix.translate(-6, 4, 4);
    modelMatrix.scale(0.2, 8, 0.2);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Street Light base
    pushMatrix(modelMatrix);
    modelMatrix.translate(0, 4, 14.5);
    modelMatrix.scale(0.2, 8, 0.2);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Street Light Neck
    pushMatrix(modelMatrix);
    modelMatrix.translate(-6, 7.9, 4.5);
    modelMatrix.scale(0.2, 0.2, 1);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    if(STREET_LIGHTS){
        n = initVertexBuffers(gl, 255/255, 251/255, 234/255, 0.9);
    }
    else{
        n = initVertexBuffers(gl, 100/255, 100/255, 100/255, 1);
    }

    // Street Light Lamp
    pushMatrix(modelMatrix);
    modelMatrix.translate(6, 7.75, 4.75);
    modelMatrix.scale(0.18, 0.1, 0.4);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Street Light Lamp
    pushMatrix(modelMatrix);
    modelMatrix.translate(-6, 7.75, 4.75);
    modelMatrix.scale(0.18, 0.1, 0.4);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    // Street Light Lamp
    pushMatrix(modelMatrix);
    modelMatrix.translate(0, 7.75, 13.75);
    modelMatrix.scale(0.18, 0.1, 0.4);
    drawCube(gl, u_ModelMatrix, u_NormalMatrix, n);
    modelMatrix = popMatrix();

    gl.uniform1i(u_UseTextures, USE_TEXTURES);
}

function drawCube(gl, u_ModelMatrix, u_NormalMatrix, n) {
    pushMatrix(modelMatrix);
    gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
    normalMatrix.setInverseOf(modelMatrix);
    normalMatrix.transpose();
    gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
    gl.drawElements(gl.TRIANGLES, n, gl.UNSIGNED_BYTE, 0);
    modelMatrix = popMatrix();
}

function loadTexture(gl, tex, textureIndex) {
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.activeTexture(textureIndex);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tex.image);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, tex.image);
}

function initArrayBuffer(gl, attribute, data, num, type) {
    // Create a buffer object
    let buffer = gl.createBuffer();
    if (!buffer) {
        console.log('Failed to create the buffer object');
        return false;
    }
    // Write date into the buffer object
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    // Assign the buffer object to the attribute variable
    let a_attribute = gl.getAttribLocation(gl.program, attribute);
    if (a_attribute < 0) {
        console.log('Failed to get the storage location of ' + attribute);
        return false;
    }
    gl.vertexAttribPointer(a_attribute, num, type, false, 0, 0);
    gl.enableVertexAttribArray(a_attribute);

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    return true;
}

function initVertexBuffers(gl, r, g, b, a) {
    // Create a cube
    //    v6----- v5
    //   /|      /|
    //  v1------v0|
    //  | |     | |
    //  | |v7---|-|v4
    //  |/      |/
    //  v2------v3
    let vertices = new Float32Array([   // Coordinates
        0.5, 0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, // v0-v1-v2-v3 front
        0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, // v0-v3-v4-v5 right
        0.5, 0.5, 0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, // v0-v5-v6-v1 up
        -0.5, 0.5, 0.5, -0.5, 0.5, -0.5, -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, // v1-v6-v7-v2 left
        -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5, // v7-v4-v3-v2 down
        0.5, -0.5, -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5  // v4-v7-v6-v5 back
    ]);


    let colors = new Float32Array([    // Colors
        r, g, b, a, r, g, b, a, r, g, b, a, r, g, b, a,  // v0-v1-v2-v3 front
        r, g, b, a, r, g, b, a, r, g, b, a, r, g, b, a,     // v0-v3-v4-v5 right
        r, g, b, a, r, g, b, a, r, g, b, a, r, g, b, a,     // v0-v5-v6-v1 up
        r, g, b, a, r, g, b, a, r, g, b, a, r, g, b, a,    // v1-v6-v7-v2 left
        r, g, b, a, r, g, b, a, r, g, b, a, r, g, b, a,    // v7-v4-v3-v2 down
        r, g, b, a, r, g, b, a, r, g, b, a, r, g, b, a     // v4-v7-v6-v5 back
    ]);


    let normal = new Float32Array([    // Normal
        0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0,  // v0-v1-v2-v3 front
        1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0,  // v0-v3-v4-v5 right
        0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0,  // v0-v5-v6-v1 up
        -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0,  // v1-v6-v7-v2 left
        0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0,  // v7-v4-v3-v2 down
        0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0   // v4-v7-v6-v5 back
    ]);

    // Texture Coordinates
    let texCoords = new Float32Array([
        1.0, 1.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0,  // v0-v1-v2-v3 front
        0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 1.0, 1.0,  // v0-v3-v4-v5 right
        1.0, 0.0, 1.0, 1.0, 0.0, 1.0, 0.0, 0.0,  // v0-v5-v6-v1 up
        1.0, 1.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0,  // v1-v6-v7-v2 left
        0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0,  // v7-v4-v3-v2 down
        0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0   // v4-v7-v6-v5 back
    ]);

    // Indices of the vertices
    let indices = new Uint8Array([
        0, 1, 2, 0, 2, 3,    // front
        4, 5, 6, 4, 6, 7,    // right
        8, 9, 10, 8, 10, 11,    // up
        12, 13, 14, 12, 14, 15,    // left
        16, 17, 18, 16, 18, 19,    // down
        20, 21, 22, 20, 22, 23     // back
    ]);

    if (!initArrayBuffer(gl, 'a_Position', vertices, 3, gl.FLOAT)) return -1;
    if (!initArrayBuffer(gl, 'a_Color', colors, 4, gl.FLOAT)) return -1;
    if (!initArrayBuffer(gl, 'a_Normal', normal, 3, gl.FLOAT)) return -1;
    if (!initArrayBuffer(gl, 'a_TexCoords', texCoords, 2, gl.FLOAT)) return -1;

    // Unbind the buffer object
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    // Write the indices to the buffer object
    let indexBuffer = gl.createBuffer();
    if (!indexBuffer) {
        console.log('Failed to create the buffer object');
        return false;
    }

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    return indices.length;
}

function display_HUD() {
    let ctx = hud.getContext("2d");
    ctx.clearRect(0, 0, 650, 650);
    ctx.font = '12px Arial Black';
    ctx.fillStyle = 'rgba(255, 255, 255, 1)';
    ctx.fillText('DAY / NIGHT CYCLE = 1', 450, 15);
    ctx.fillText('STREET LIGHTS ON / OFF = 2', 450, 30);
    ctx.fillText('TEXTURES ON / OFF = 3', 450, 45);
    ctx.fillText('OPEN / CLOSE DOOR = 4', 450, 60);
    ctx.fillText('OPEN / CLOSE BLINDS = 5', 450, 75);
    ctx.fillStyle = 'rgba(0, 0, 0, 1)';
    ctx.font = '14px Arial Black';
    let DAY = null;
    if(SUNLIGHT === 1){
        DAY = 'MIDDAY';
    }
    else if(SUNLIGHT === 2){
        DAY = 'DUSK';
    }
    else if(SUNLIGHT === 3){
        ctx.fillStyle = 'rgba(255, 255, 255, 1)';
        DAY = 'MIDNIGHT';
    }
    else{
        DAY = 'DAWN';
    }
    ctx.fillText(DAY, 550, 640);
    ctx.fillText("x = " + x_coord.toFixed(2) + ",\t\t " + "y = " + y_coord.toFixed(2) + ",\t\t " + "z = " + z_coord.toFixed(2), 5, 640);
}