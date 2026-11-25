// Mesh Master File

global_settings { assumed_gamma 2.2 }

#declare scal=1.1;

#include "colors.inc"

#declare bb=.5;

background {color White} // background color

#declare stereo =0;
camera {
	location <0,0,-4>+stereo*<.1,0,0>

 	right x*image_width/image_height    
	 angle 40 look_at 0
 }

 light_source { 
	 <4,0,-20>
 	color  rgb <1,1,bb>
//	shadowless
 }
 light_source { 
 	<0,4,-12>
 	color  rgb <bb,1,1>
//	shadowless
 }
 light_source { 
 	<0,-4,-20>
	 color  rgb <1,bb,1>
//	shadowless
 }
 light_source { 
 	<-4,0,-20>
	 color  rgb <1,bb,1>
//	shadowless
 }




// texture parameters



#declare meshcolor1=rgbf <0.828118, 0.801545, 0.397923 ,0>;
#declare meshcolor2=rgbf <0.666336, 0.716156, 0.833768 ,0>;




//#declare meshcolor1=rgbt <0.719463, 0.381231, 0.458305,.2>;
//#declare meshcolor2=rgbt <0.303410, 0.607736, 0.719463,.2>;
//
//

#declare spherecolor = rgb <0.76, .76, 0.8>/4;  


#declare rodcolor1 =  rgb <0.284085, 0.235470, 0.327169>;  
#declare rodcolor2 = rgb <0.315908, 0.296315, 0.131823>;





#declare RodFinish  =
finish {
    ambient 0.25
    brilliance 3
    diffuse 0.5
    metallic
    specular 0.70
    roughness 1/80
}


#declare SphereFinish = 
finish {
	specular 1
	phong 1
	roughness .1
	metallic
} 


#declare MeshFinish =
finish {
	ambient .2
	diffuse .2
	specular .1 
	roughness 0.16 
}
#declare mesh_texture1 = texture { 
			pigment {
				color meshcolor1
			}
			finish {
   				MeshFinish
 			}
}

#declare mesh_texture2 = texture {
pigment {
				color meshcolor2 
			}
			finish {
   				MeshFinish
 			}
}

// thicknesses of spheres and rods

#declare linerad=0.003/scal;
#declare sphererad=0.006/scal;

// include generated file

#include "dummy.pov"

#declare fundpiece = object{
union {

	object {MESHtriangles
		texture { 
					mesh_texture1
				}
				interior_texture { 
					mesh_texture2
				}
		}
	object {MESHspheres
		pigment {spherecolor }    
				finish{SphereFinish} 
		}
	object {MESHhorlines
		pigment {rodcolor1}     
				finish{RodFinish} 
		}
	object {MESHverlines
		pigment {rodcolor2}     
				finish{RodFinish} 
		}

}
}


	object{fundpiece 
scale scal
//rotate <0,00,20>
rotate <45,0,0>
//
translate <0,.1,0>
	
}