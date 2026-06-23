<script lang="ts">
  import './layout.css';
  import favicon from '$lib/assets/favicon.svg';

  let { children } = $props();
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
  <title>Estado de servicios SIFEN</title>
  <meta
    name="description"
    content="Monitoreo de disponibilidad y tiempos de respuesta de los servicios SIFEN."
  />
  <meta property="og:title" content="Estado de servicios SIFEN" />
  <meta
    property="og:description"
    content="Monitoreo de disponibilidad y tiempos de respuesta de los servicios SIFEN."
  />
  <meta property="og:type" content="website" />
  <meta property="og:locale" content="es_PY" />
  <meta property="og:site_name" content="Estado SIFEN" />
  <meta name="twitter:card" content="summary" />
</svelte:head>

{@render children()}
