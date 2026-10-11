// Shared mutable rig: GSAP ScrollTrigger writes progress 0→1 here,
// the 3D camera reads it every frame. Mouse parallax too.
export const scrollRig = {
  progress: 0,
  mouseX: 0,
  mouseY: 0,
};
