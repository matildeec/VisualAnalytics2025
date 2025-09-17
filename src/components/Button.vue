<script setup>
defineProps({
	to: { type: String, required: true },
	icon: { type: String, required: true },
	label: { type: String, required: true }
})
</script>

<template>
	<router-link :to="to" class="focus:outline-none">
		<span class="inline-flex items-center gap-2 px-4 py-1 rounded-2xl bg-white/10 hover:bg-white/20 transition text-white text-sm shadow-sm">
			<img :src="icon" :alt="label + ' icon'" class="w-4 h-4" />
			{{ label }}
		</span>
	</router-link>
</template>