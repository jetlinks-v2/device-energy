<script setup lang="ts">
import { feText } from '../../shared/i18n'
import { energyNumber, type EnergyType } from '../../shared/energyOverview'
import water from '../../assets/energy-overview/water-meter.webp'
import electricity from '../../assets/energy-overview/electricity-meter.webp'
import gas from '../../assets/energy-overview/gas-meter.webp'
import buildings from '../../assets/energy-overview/property-buildings.webp'
defineProps<{ cards: { type: EnergyType; value?: number; unit: string; meters?: number; complete: boolean }[]; selected: EnergyType; loading: boolean }>()
const emit = defineEmits<{ select: [type: EnergyType] }>()
const images = { water, electricity, gas }
const names = { water: 'overviewWaterUsage', electricity: 'overviewElectricityUsage', gas: 'overviewGasUsage' } as const
const labels = { water: 'eoWaterMetering', electricity: 'eoElectricityMetering', gas: 'eoGasMetering' } as const
</script>
<template>
  <section class="eo-scene" :aria-label="feText('eoUsageSummary')">
    <header class="eo-scene-heading"><h2>{{ feText('eoUsageSummary') }}</h2><a-tooltip :title="feText('eoUsageBasis')"><span><AIcon type="InfoCircleOutlined" /> {{ feText('eoPeriodMetering') }}</span></a-tooltip></header>
    <div class="eo-scene-stage">
      <svg v-for="link in 3" :key="link" class="eo-scene-conduit" :style="{ left: (12.5 + (link - 1) * 25) + '%' }" viewBox="0 0 200 70" preserveAspectRatio="none" aria-hidden="true">
        <path class="eo-conduit-shadow" d="M0 48 C50 12 150 12 200 48" />
        <path class="eo-conduit-edge" d="M0 48 C50 12 150 12 200 48" />
        <path class="eo-conduit-core" d="M0 48 C50 12 150 12 200 48" />
      </svg>
      <button v-for="card in cards" :key="card.type" :class="['eo-scene-node', card.type, { selected: selected === card.type }]"
        :aria-pressed="selected === card.type" :aria-label="feText(names[card.type]) + ' ' + energyNumber(card.value) + ' ' + card.unit" @click="emit('select', card.type)">
        <span class="eo-scene-label">{{ feText(names[card.type]) }}</span>
        <a-tooltip :title="card.value !== undefined && !card.complete ? feText('eoAvailableUsage') : undefined"><strong class="eo-scene-value">{{ loading ? '—' : energyNumber(card.value) }} <small>{{ card.unit }}</small></strong></a-tooltip>
        <span class="eo-scene-platform" aria-hidden="true"><svg viewBox="0 0 220 70"><ellipse cx="110" cy="38" rx="102" ry="27" fill="#d0e5ff" opacity=".7"/><ellipse cx="110" cy="29" rx="94" ry="24" fill="#eaf7ff" stroke="#95c8ff"/><ellipse cx="110" cy="24" rx="76" ry="18" fill="#f6fcff" stroke="#b7dfff"/><path d="M24 31C45 54 175 54 196 31" fill="none" stroke="#65b9ff" stroke-width="3"/></svg></span>
        <img :src="images[card.type]" alt="" />
        <span class="eo-scene-badge">{{ feText(labels[card.type]) }}<AIcon v-if="selected === card.type" type="CheckOutlined" /></span>
      </button>
      <div class="eo-scene-node eo-scene-property">
        <span class="eo-scene-label">{{ feText('eoPropertyEnergy') }}</span>
        <strong class="eo-property-value">{{ feText('eoPropertyScene') }}</strong>
        <span class="eo-scene-platform" aria-hidden="true"><svg viewBox="0 0 220 70"><ellipse cx="110" cy="38" rx="102" ry="27" fill="#d0e5ff" opacity=".7"/><ellipse cx="110" cy="29" rx="94" ry="24" fill="#eaf7ff" stroke="#95c8ff"/><ellipse cx="110" cy="24" rx="76" ry="18" fill="#f6fcff" stroke="#b7dfff"/><path d="M24 31C45 54 175 54 196 31" fill="none" stroke="#65b9ff" stroke-width="3"/></svg></span>
        <img :src="buildings" alt="" />
        <span class="eo-scene-badge">{{ feText('eoProjectConsumption') }}</span>
      </div>
    </div>
  </section>
</template>
<style scoped>
.eo-scene { position: relative; overflow: hidden; border-radius: 10px; padding: 12px 16px 8px; background: linear-gradient(180deg,#f6faffc9,#c8e1ffc9), url('../../assets/energy-overview/overview-background.webp') center 78% / cover; box-shadow: inset 0 0 0 2px #fff, 0 2px 6px #2558a317; }
.eo-scene-heading { display:flex; align-items:center; justify-content:space-between; position:relative; z-index:2; }.eo-scene-heading h2 { font-size:16px; font-weight:600; color:#16386c; margin:0; }.eo-scene-heading h2::before { content:''; display:inline-block; width:5px; height:16px; background:#1683ff; border-radius:3px; margin-right:9px; vertical-align:-2px; }.eo-scene-heading > span { color:#4e6e96; font-size:11px; }
.eo-scene-stage { position:relative; display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); height:166px; }
.eo-scene-conduit { position:absolute; top:84px; width:25%; height:70px; overflow:visible; pointer-events:none; }
.eo-scene-conduit path { fill:none; stroke-linecap:round; }.eo-conduit-shadow { stroke:#58a9eb; stroke-width:15px; opacity:.13; transform:translateY(5px); }.eo-conduit-edge { stroke:#78c9ff; stroke-width:8px; }.eo-conduit-core { stroke:#effcff; stroke-width:4px; }
.eo-scene-node { --scene-accent:#087cff; position:relative; display:flex; align-items:center; flex-direction:column; padding:2px 8px 0; border:0; background:transparent; color:#213e69; cursor:pointer; min-width:0; border-radius:8px; }
.eo-scene-node.electricity { --scene-accent:#b67a12; }.eo-scene-node.gas { --scene-accent:#8258c5; }.eo-scene-property { cursor:default; }
.eo-scene-label { font-size:12px; font-weight:500; }.eo-scene-node > strong { z-index:2; color:var(--scene-accent); font-size:23px; line-height:1.25; font-variant-numeric:tabular-nums; white-space:nowrap; }.eo-scene-node > strong small { font-size:12px; font-weight:500; }.eo-scene-node .eo-property-value { font-size:18px; line-height:29px; color:#1c5eae; }
.eo-scene-node > img { position:absolute; bottom:13px; height:122px; width:150px; object-fit:contain; pointer-events:none; transition:transform .2s ease; }.eo-scene-property > img { width:180px; height:128px; bottom:10px; }
.eo-scene-platform { position:absolute; width:210px; max-width:100%; bottom:2px; }.eo-scene-platform svg { width:100%; display:block; }
.eo-scene-badge { position:absolute; bottom:0; z-index:3; color:#fff; padding:2px 18px; min-width:110px; font-size:11px; border-radius:14px; background:linear-gradient(#299aff,#0670f0); box-shadow:0 3px 6px #177af338; text-align:center; white-space:nowrap; }.electricity .eo-scene-badge { background:linear-gradient(#d7a749,#b57d18); }.gas .eo-scene-badge { background:linear-gradient(#a384db,#8053c2); }.eo-scene-badge .anticon { margin-left:6px; }
.eo-scene-node:hover > img, .eo-scene-node.selected > img { transform:translateY(-3px); }.eo-scene-node:focus-visible { outline:2px solid var(--scene-accent); outline-offset:1px; }
@media(max-width:900px) { .eo-scene-stage { height:160px; }.eo-scene-node > img { width:120px; height:110px; bottom:15px; }.eo-scene-property > img { width:140px; height:112px; }.eo-scene-node > strong { font-size:19px; }.eo-scene-node .eo-property-value { font-size:15px; }.eo-scene-platform { width:170px; } }
@media(max-width:600px) { .eo-scene-stage { grid-template-columns:repeat(2,minmax(0,1fr)); height:330px; row-gap:12px; }.eo-scene-conduit { display:none; }.eo-scene-heading > span { display:none; }.eo-scene-node > img { width:142px; height:120px; }.eo-scene-property > img { width:156px; }.eo-scene-node > strong { font-size:21px; } }
@media(prefers-reduced-motion:reduce) { .eo-scene-node > img { transition:none; } }
</style>
