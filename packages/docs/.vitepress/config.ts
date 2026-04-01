import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'LinkML Modeler App',
  description: 'Visual editor for LinkML schemas',
  base: '/linkml-modeler-app/',
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'User Guide', link: '/user-guide' },
      { text: 'Development', link: '/development' },
      { text: 'Design Spec', link: '/design-spec' },
    ],
    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'Introduction', link: '/' },
          { text: 'User Guide', link: '/user-guide' },
        ],
      },
      {
        text: 'Developer',
        items: [
          { text: 'Development Guide', link: '/development' },
          { text: 'Design Spec', link: '/design-spec' },
        ],
      },
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/linkml/linkml-modeler-app' },
    ],
  },
})
