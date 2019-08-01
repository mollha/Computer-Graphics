README.TXT

INSTRUCTIONS TO RUN THE PROGRAM
To run the application WITH textures enabled, cross-origin resource sharing must be enabled:
    - Navigate to the root directory from a terminal
    - Enter the command "python -m http.server"
    - Navigate to localhost (the directory is hosted at http://127.0.0.1:8000)

If the above steps are un-successful, run the application WITHOUT textures as follows:
    - Navigate to the root directory
    - Click on index.html to run the application locally

- It is advised to run the application on Google Chrome as some features may appear different in other browsers due to variations in requestAnimationFrame()

![Image of dawn](https://raw.githubusercontent.com/mollha/Computer-Graphics/master/example.PNG)



DESCRIPTION
I have modeled my own house in Durham and its surroundings - the reference image is included in the main directory (reference.png). A variety of cars will pass by the house - the wheels rotate as the cars drive forward and in 3 cars will honk their horn too!
All models are constructed by me from primitive shapes and I have used both directional and ambient lighting. Initially the day / night cycle is set to midday - the current time of day is visible in the bottom right corner (HUD). For best results, wait until each transition has ended before starting the next.

The following functionality is provided:
    1: Cycle through day / night
    2: Toggle street lights on / off - they are initially toggled off
    3: Toggle textures on / off - they are initially toggled off
    4: Open / close the front door
    5: Open / close the blinds - length of the blinds changes while the "5" key is pressed

- Rotate the camera view using the arrow keys
- Move the camera position:
    W: forward (zoom-in)
    A: left
    S: backward (zoom-out)
    D: right
    Z: up
    X: down
    
    
