<script setup>
import Button from './Button.vue'
</script>

<template>
	<nav class="relative navbar px-4 py-3 flex items-center justify-between">
		<div class="font-bold text-lg">FishEye</div>
				<div class="flex gap-4">
					<Button
						to="/"
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