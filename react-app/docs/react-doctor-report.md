# React Doctor Report

Generated: 2026-06-12
Project: `react-app`
Command: `npx react-doctor@latest --verbose`

## Summary

- Score: `53 / 100 Critical`
- Total issues: `86`
- Bugs: `4 errors`, `49 warnings`
- Performance: `15 warnings`
- Maintainability: `18 warnings`
- Share URL: https://react.doctor/share?p=react-app&s=53&e=4&w=82&f=33
- Local raw diagnostics: `/var/folders/2b/_5rm03yx26v0ccmjczqrjjsw0000gn/T/react-doctor-2b8ddc4f-016d-4de9-81e0-d3070c7b5869`

## Key Takeaway

The previous diff scan scored `100 / 100` because it only checked uncommitted changes. The full project scan shows substantial existing React debt, especially around effect-driven state synchronization, oversized screens/components, list rendering performance, and broad state management inside large components.

## Errors

### `react-doctor/no-adjust-state-on-prop-change`

State is synchronized to props inside an effect, causing users to briefly see stale UI before the next render commits.

Affected locations:

- `src/screens/HomeScreen.tsx:129`
- `src/hooks/useDelayedLoading.ts:8`

Recommended direction:

- Remove duplicated state when it can be derived during render.
- If local state must reset when a prop changes, use an inline previous-prop comparison during render instead of routing the change through `useEffect`.
- Start here because these are the only error-level diagnostics.

## High Priority Warnings

### `react-doctor/exhaustive-deps`

Several effects are missing dependencies, which can run logic with stale values.

Affected locations:

- `src/components/CommentSection.tsx:222`
- `src/screens/AiChatScreen.tsx:32`
- `src/screens/HomeScreen.tsx:116`
- `src/screens/HomeScreen.tsx:123`
- `src/screens/messages/SwipeConversationRow.tsx:35`
- `src/screens/MessagesScreen.tsx:81`

Recommended direction:

- Read each effect before changing dependencies.
- Prefer moving recreated values inside the effect or stabilizing only where it preserves behavior.
- Avoid blindly adding dependencies if it would introduce loops.

### `react-doctor/no-event-handler`

Some event-like side effects are triggered by state plus `useEffect`, which adds extra renders and runs later than the event that caused them.

Affected locations:

- `src/screens/HomeScreen.tsx:119`
- `src/screens/HomeScreen.tsx:162`

Recommended direction:

- Move event-specific work into the event handler that triggers it.
- Keep effects for synchronization with external systems, not internal event chains.

### `react-doctor/no-chain-state-updates`

State updates are chained through effects, causing additional render steps.

Affected location:

- `src/screens/ChatScreen.tsx:109`

Recommended direction:

- Set related state together in the original event handler or reducer.

### `react-doctor/no-cascading-set-state`

Multiple state updates happen inside one effect.

Affected location:

- `src/screens/HomeScreen.tsx:125`

Recommended direction:

- Combine related state into one state object or reducer when the updates represent one logical transition.

## Architecture And Maintainability

### `react-doctor/no-giant-component`

Large components are hard to read, change, and test.

Affected locations:

- `src/components/CommentSection.tsx:50`
- `src/screens/BlogScreen.tsx:38`
- `src/screens/AuthorScreen.tsx:42`
- `src/screens/profile/LoggedInProfileScreen.tsx:45`
- `src/screens/HomeScreen.tsx:42`
- `src/screens/UploadScreen.tsx:47`

Recommended direction:

- Split by responsibility rather than by arbitrary line count.
- Good extraction targets are list items, headers, empty states, dialogs, form sections, and data-specific hooks.
- Prioritize `HomeScreen` and `CommentSection` because they also have many state/effect diagnostics.

### `react-doctor/prefer-useReducer`

Many related `useState` calls can produce scattered updates and separate renders.

Affected locations:

- `src/components/CommentSection.tsx:60`
- `src/screens/BlogScreen.tsx:48`
- `src/screens/AuthorScreen.tsx:50`
- `src/screens/ProfileSettingsScreen.tsx:31`
- `src/screens/ProfileAnalyticsScreen.tsx:112`
- `src/screens/HomeScreen.tsx:48`
- `src/screens/AuthScreen.tsx:24`
- `src/screens/ChatScreen.tsx:43`
- `src/screens/UploadScreen.tsx:51`
- `src/screens/MessagesScreen.tsx:46`

Recommended direction:

- Only introduce reducers where state fields are truly related.
- Avoid mechanical reducer conversions for isolated fields.
- For large screens, first identify state groups such as loading/query/filter/modal/form/list status.

### Unused Files And Exports

Affected rules:

- `deslop/unused-file`
- `deslop/unused-export`
- `deslop/unused-dev-dependency`

Affected locations:

- `src/components/samplePosts.ts`
- `src/hooks/useApiErrorHandler.ts`
- `src/components/Skeleton.tsx:15`
- `src/components/styles.ts:38`
- `src/components/styles.ts:44`
- `src/services/apiError.ts:19`
- `src/theme/ThemeProvider.tsx:20`
- `src/theme/colors.ts:53`
- `package.json` dev dependency: `react-doctor`

Recommended direction:

- Confirm each item is truly unused before deleting or unexporting.
- Keep exported APIs if they are intentionally public or used outside static analysis visibility.

## Performance Findings

### List Rendering

Affected rules:

- `react-doctor/rn-no-scrollview-mapped-list`
- `react-doctor/rn-no-inline-flatlist-renderitem`
- `react-doctor/rn-list-callback-per-row`
- `react-doctor/rn-no-inline-object-in-list-item`
- `react-doctor/no-array-index-as-key`

Affected locations:

- `src/screens/MessagesScreen.tsx:235`
- `src/screens/AuthorScreen.tsx:348`
- `src/screens/AiChatScreen.tsx:162`
- `src/screens/HomeScreen.tsx:393`
- `src/screens/ChatScreen.tsx:231`
- `src/screens/NotificationScreen.tsx:84`
- `src/screens/AuthorScreen.tsx:353`
- `src/screens/AuthorScreen.tsx:359`
- `src/screens/NotificationScreen.tsx:90`
- `src/screens/AiChatScreen.tsx:164`
- `src/screens/ChatScreen.tsx:240`
- `src/screens/NotificationScreen.tsx:86`
- `src/screens/NotificationScreen.tsx:112`
- `src/components/MarkdownText.tsx:291`
- `src/components/MarkdownText.tsx:298`

Recommended direction:

- Replace mapped lists inside `ScrollView` with `FlatList` or another virtualized list.
- Move `renderItem` functions and per-row handlers out of inline JSX where it benefits memoized rows.
- Use stable item identifiers instead of array indexes as keys.

### Unstable Values And Redundant Renders

Affected rules:

- `react-doctor/jsx-no-constructed-context-values`
- `react-doctor/rerender-state-only-in-handlers`
- `react-doctor/rerender-memo-with-default-value`
- `react-doctor/rerender-lazy-ref-init`
- `react-doctor/prefer-module-scope-static-value`
- `react-doctor/prefer-module-scope-pure-function`
- `react-doctor/jsx-no-jsx-as-prop`

Affected locations:

- `src/theme/ThemeProvider.tsx:60`
- `src/components/CommentSection.tsx:76`
- `src/screens/AuthorScreen.tsx:56`
- `src/screens/ProfileSettingsScreen.tsx:45`
- `src/screens/HomeScreen.tsx:65`
- `src/components/CollectionCard.tsx:18`
- `src/hooks/useScrollItemAboveKeyboard.ts:22`
- `src/screens/HomeScreen.tsx:78`
- `src/screens/HomeScreen.tsx:81`
- `src/screens/ProfileSettingsScreen.tsx:125`
- `src/screens/BlogScreen.tsx:339`
- `src/screens/profile/LoggedInProfileScreen.tsx:218`

Recommended direction:

- Use refs for values that do not affect rendering.
- Move static arrays/functions to module scope when they do not depend on component state.
- Memoize context values where consumers would otherwise rerender unnecessarily.

### Images And Navigation

Affected rules:

- `react-doctor/rn-prefer-expo-image`
- `react-doctor/rn-no-non-native-navigator`

Affected locations:

- `src/screens/ProfileSettingsScreen.tsx:3`
- `src/screens/blog/BlogReadContent.tsx:1`
- `src/screens/profile/ProfileListHeader.tsx:2`
- `src/screens/upload/ImageUploadPanel.tsx:1`
- `src/screens/messages/MessageAvatar.tsx:1`
- `src/screens/blog/BlogImagePreviewModal.tsx:1`
- `src/components/MarkdownText.tsx:2`
- `src/screens/profile/ProfileHeader.tsx:1`
- `App.tsx:12`

Recommended direction:

- Consider replacing React Native `Image` with `expo-image` for cache and loading behavior.
- Treat navigator changes as architecture-level work because they can affect gestures, transitions, and route behavior.

## Suggested Fix Order

1. Fix `no-adjust-state-on-prop-change` errors in `HomeScreen` and `useDelayedLoading`.
2. Fix high-confidence stale-effect issues in `HomeScreen`, `MessagesScreen`, and `CommentSection`.
3. Refactor `HomeScreen` event/effect chains before broad component splitting.
4. Address list virtualization and stable keys in screens with user-visible scrolling.
5. Split `CommentSection` and other giant components by responsibility.
6. Clean unused files/exports after confirming they are not intentionally public.
7. Consider `expo-image` and navigator migration as separate, behavior-sensitive work.

## Validation Commands

Run these from `react-app/` after focused changes:

```bash
npm run typecheck
npx react-doctor@latest --verbose --diff
```

For a full re-score after cleanup:

```bash
npx react-doctor@latest --verbose
```
