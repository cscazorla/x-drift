Quiero implementar juego 3d para navegadores web sobre batallas espaciales en una galaxia. El jugador usará una nave tipo x-wing que irá mejorando conforme elimina a otros enemigos. El nombre del proyecto es x-drift. Los requisitos del juego son:

- Usar la tecnología threejs y que sea compatible con navegadores
- El desarrollo debe ser con Typescript y Node.js
- El juego será online. La arquitectura debe ser cliente - servidor para evitar que los jugadores hagan trampas. Es decir, el código que ejecuta el cliente en el navegador gestiona las entradas del jugador (e.g. movimiento, disparo, etc.) y se envían al servidor. El servidor es que el que recoge constantemente el input de todos los jugadores, realiza todos los cálculos físicos (actualizar la posición, disparos, colisiones, etc.) y devuelve a cada jugador su posición actual y demás datos.

El proyecto comienza desde cero en un repositorio en limpio. Quiero avanzar muy lentamente e ir implementando todo paso por paso: arquitectura cliente-servidor, gameloop, etc.

Este repositorio estará alojado en github y me gustaría desplegarlo en CloudFlare.

Analiza todos estos requisitos y propón un stack tecnológico adecuado para trabajar en local.
