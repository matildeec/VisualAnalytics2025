<script setup>
import Button from './Button.vue'
</script>

<template>
	<nav class="relative navbar px-4 py-3 flex items-center justify-between">
		<span class="inline-flex items-center gap-2 px-4 py-1 rounded-2xl text-white font-bold text-lg">
			<img src="../assets/fisheye-icon.svg" alt='FishEye icon' class="w-8 h-8" />
			FishEye International
		</span>
				<div class="flex gap-4">
					<Button
						to="/"
						icon="/src/assets/map-icon.svg"
						label="See Map"
					/>

					<Button
						to="/inspectharbor"
						icon="/src/assets/anchor-icon.svg"
						label="Inspect Harbor"
					/>
					<Button
						to="/comparetrajectories"
						icon="/src/assets/vessel-icon.svg"
						label="Compare Trajectories"
					/>
				</div>
	</nav>
</template>

<style scoped>
.navbar {
  background: var(--main-deep-blue);
  color: var(--main-white);
}
.nav-link {
  color: var(--main-white);
}
.nav-link:hover {
  color: var(--main-dark-grey);
}
</style>