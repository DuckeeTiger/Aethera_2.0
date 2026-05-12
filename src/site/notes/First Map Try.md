---
{"dg-publish":true,"permalink":"/first-map-try/","noteIcon":"","dg-note-properties":{"map_height_y":3456,"map_width_x":6144,"scale_pixels":2405,"scale_pixels_range":200,"mapCalc1":0.08316008316008315}}
---



```leaflet  
id: AetheraWorldMap ### Must be unique with no spaces  
image: [Aethera_Labeled_v4.png](/img/user/images/Aethera_Labeled_v4.png) ### Link to the map image file. Do not add a ! in front of the image  
bounds: [[0,0], [3456, 6144]] ### Size of the map in px Height_y, Width_x. Ignore 0,0  
height: 700px ### Size of the leaflet embed in px on your screen  
width: 95% ### Size of the leaflet embed in your note  
lat: 1728 ### To center the map, make this half of the map height.  
long: 3072 ### To center the map, make this half of the map width.  
minZoom: -3 ### Controls how far away from the map you can zoom out. Hover over the target icon to see the current level.  
maxZoom: 2.5 ### Controls how far towards the map you can zoom in. Hover over the target icon to see the current level.  
defaultZoom: -1 ### Sets the default zoom level when the map loads. Hover over the target icon to see the current level.  
zoomDelta: 0.5 ### Adjust how much the zoom changes when you zoom in or out.  
unit: km ### The value displayed when measuring so you know what type of unit is being measure.  
scale: 0.250 ### Real units/px (resolution) of your map  
recenter: false  
darkmode: false ### marker
```