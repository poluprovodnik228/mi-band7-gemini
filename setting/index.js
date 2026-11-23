AppSettingsPage({
  build(props) {
    return [
      Section(
        {
          title: 'Google Gemini API'
        },
        [
          TextInput({
            label: 'Gemini API Key',
            settingsKey: 'geminiApiKey',
            placeholder: 'Paste key (AIzaSy...) from Google AI Studio'
          })
        ]
      ),
      Section(
        {
          title: 'OpenRouter (Optional)'
        },
        [
          Toggle({
            label: 'Use OpenRouter',
            settingsKey: 'useOpenRouter'
          }),
          TextInput({
            label: 'OpenRouter API Key',
            settingsKey: 'openRouterApiKey',
            placeholder: 'sk-or-...'
          })
        ]
      )
    ]
  }
})
