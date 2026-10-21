// Fotos del álbum público de la edición 2026 (las mismas que sirve /api/album/photos)
// y rutas a los logos del repo. Lo comparten los cinco bocetos.
const FOTOS = {
  280: 'https://lh3.googleusercontent.com/pw/AP1GczMC1vt5v1GlzEF9HGSmF_NNo2DfPTRZ1AoPfM5PjR-YCgbAvWuHi-c7mA2_CfHOgOCLHNbpQr_eH2QVyWyfe-qeAs9E-dKlOsEE9AocFnwo06mnr44N',
  28:  'https://lh3.googleusercontent.com/pw/AP1GczMFItypUWF33pPdwSgPr3s0My7VQuYeifFxzInm9KZy5zGPwoFyjNUVK8oFtw3NQj_nm3YXop7R4cit450ssoI5bkPvTEiMFqXdqT2S-i-MkN-z39TT',
  14:  'https://lh3.googleusercontent.com/pw/AP1GczMDq9iHMcEivzoMD-SI8o87SeFme11IAoEgQx6qknOJy7_TTAbxYW8mjnk5kej2y21J7WWBx0pjDC1C2bPqGgggNyJbEzL5YyIWk-eqyQh2Rju4Xiv5',
  490: 'https://lh3.googleusercontent.com/pw/AP1GczNHuobzFh7WTxkrHhjBwISkdZmeMuTtckLMX4IRO8IpdkeSxTYKZ4dy6quI4BF5vNqNtpQ45e6VpA5txdp-s3FOwYEoczohKnaNn4BYEQwY-LXkamc_',
  434: 'https://lh3.googleusercontent.com/pw/AP1GczMRq547EtwufBXhWlQIXhYj5E9oY8UZdK_QUzu3NH3zYf1sotCYBBPw36aubwUsRvdEn2f5o9_i0HydarM1aTsd7YfH7KcgcaTwienQ0GHXYXO7oJhN',
  602: 'https://lh3.googleusercontent.com/pw/AP1GczOEvoCFq2nwhu6-I_CDwa-3uhsXfpgy0zOMfdv-QVoCm6rf2enA_KDeeb_lhSScb7ybV6KrYBjezulcXd_EhRoXXNZli9EIYgG_kCUrVvzt1KF3v3sV',
  630: 'https://lh3.googleusercontent.com/pw/AP1GczMZkGK16SNyEPZK5cFwWdgR9CVPbtu4Sz7VG7LyHsTynzIwidRjyOr97y1iHQ0vY7oewRWb6d9JKUl5tVf_lADZjMJGpOZBRZ-rgkvDhfZVbjS_uIZ_',
  252: 'https://lh3.googleusercontent.com/pw/AP1GczNa6Mm2E0o2b0sqPcVNPKl0Au--J3LlmrzRBPgAJ4uGVz7nh8Rsgiyl8lcOBBvkaROkuSYiCOGwTHZMhGu5USB5Z1vheiLq04qQ4nwwfIU9yY1VzSVN',
  266: 'https://lh3.googleusercontent.com/pw/AP1GczOPRrhXCPdYT8ljdhU0lXDxojhmUxH3R7JgcN2ulgcoZPe2ssatpRl-TtPdXInz2umlh4pgbyT7XpRBSz_Lg2b26aZr9jEGKAxWvFG_dFV_5eTaFlpE',
  308: 'https://lh3.googleusercontent.com/pw/AP1GczM7lz1xSaTlN2RJ9F7IoLzJbb3-Sni5rUyMGRKakJfA6zkEeYBxbEw-TkAvsvGNG_riK56ZBZJGGADi_7dLBNBXLZ-7bDgHifRAKWpgNXVRgc8WVffn',
  210: 'https://lh3.googleusercontent.com/pw/AP1GczNkkKLgJmWZs08W_vOi3EaWz6jaQpZhZt2dm1gX-vXEJAezQO_DBuR5nPFaA-WoVt86DPQGVN5lStGowtVSm7EU1djUeZfnU06uEQu8cDls3Qw0xTQs',
  168: 'https://lh3.googleusercontent.com/pw/AP1GczNsLCd0MBWNqn9t_rW5dPeTRtFL6Z3T2g8C69_BQFB0uVG7KKg6-mGG3mjENhMSIQD5E6IB3xc3pDiSbzL76pWvw8Fn9zs3diCapEsrIbl3-EsIYNlM',
  462: 'https://lh3.googleusercontent.com/pw/AP1GczNHGPXiupPj2L98vsnDYYgCJVQQgfvp4u6SJF5-atqP5KuNklIF7KYhYJFdLoDRONPtzg1evIX2GI2RkRR310yBlsbDmbbOR2a4t6ZfLCeynE1d9Jpr',
  658: 'https://lh3.googleusercontent.com/pw/AP1GczONjcdachx_os6T8hJ4XoirAITKogYBFIW3fXuMD0g6tXH4VVtMOoKJv07KwbZ93IkcuVDSwHjuh0OTLt2ucUR-XWAsKTxA5-PFxhGGEhQk8e3NI9yg',
  42:  'https://lh3.googleusercontent.com/pw/AP1GczP5RY_Bka19GfDq8A50ALuO4SB0ViUuxUNO-C8tBNGoL6Z2OQ7Uqznfd3aoq_emHAoRD03S14iA5NU0_-9aKscxL-HUEEMOUfEbAF6HfWiowdPGX4zv',
  238: 'https://lh3.googleusercontent.com/pw/AP1GczPJpQw-GpvVjcBn-Hph4_LNs6p9oJq07_oam2nDfMnwNJ_pzDoElvN4Fq-eh3796iHGoOH-AR8GsUkum9jI-P7HU1v3Z35HCSjy9Xwb2gpM85aL5Jjs',
  56:  'https://lh3.googleusercontent.com/pw/AP1GczPul_xdaNvOEguFH4RDlB7NiXkAGkWsise86lvPzWYrc5nCUPDd5bT1NJ6EIWwzJjNu1hdZcDV68xGK59pN4Rum-CexIKaM3nfaniGF3l-I_-NTSthO',
  364: 'https://lh3.googleusercontent.com/pw/AP1GczOxm-GapeB9ayaHFaCekt-cG14-92VfWH_tx9PcgWQOSmKcVxt6cly5v7YvrDx8ET3ShsrPzo_eDDo57AffKtGzSMz2BXft03Ul4zJZyZK01jT2Y30K',
  98:  'https://lh3.googleusercontent.com/pw/AP1GczPRG1-2r4nsJEYDmFKIsXr_K2h3UozsrH5VZtIePX3e3JGhDaxu9aHA8dqslVPeUDQj2pqTNbLnbfQ1cwh3HH3ttoD-kJsy0n2o1bchlS6Qh_BRbeU6',
  448: 'https://lh3.googleusercontent.com/pw/AP1GczMp5pnVVVgQdIiv9EMip0EWIAX5Dih9MbrVugtOhmPhC782tqzkQ_4oE-mLy4eIH09hoPNBWENG_vm-ezt8PRT74RV3b4gEHIxiwti14RYvoHQL1GsB',
};
const LOGO = '../../frontend/public/logo-backyard-ultra.png';
const CEDIMAT = '../../frontend/public/sponsors/cedimat.svg';
const CEDIMAT_BLANCO = '../../frontend/public/sponsors/cedimat-blanco.svg';

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-foto]').forEach(el => {
    const n = el.getAttribute('data-foto');
    const w = el.getAttribute('data-w') || '1600';
    const url = FOTOS[n] + '=w' + w;
    if (el.tagName === 'IMG') el.src = url; else el.style.backgroundImage = `url("${url}")`;
  });
  document.querySelectorAll('[data-logo]').forEach(el => el.src = LOGO);
  document.querySelectorAll('[data-cedimat]').forEach(el => el.src = el.getAttribute('data-cedimat') === 'blanco' ? CEDIMAT_BLANCO : CEDIMAT);
});
