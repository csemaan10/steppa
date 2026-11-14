import { BlurTargetView } from 'expo-blur';
import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import { StyleSheet } from 'react-native';

import { FloatingTabBar, TabButton } from '@/components/floating-tab-bar';
import { tabsBlurTarget } from '@/components/frost';
import { Pane } from '@/components/pane';

export default function TabLayout() {
  // Android blurs only what's inside this target, so the screens live in it and the bar (and anything
  // frosted over the screens, see Frost) sits outside.
  const blurTarget = tabsBlurTarget;

  return (
    <Tabs style={styles.flex}>
      <BlurTargetView ref={blurTarget} style={styles.flex}>
        {/* Visited tabs stay mounted in a hidden Pane, so coming back never replays their animations. */}
        <TabSlot
          detachInactiveScreens={false}
          renderFn={(descriptor, { isFocused, loaded }) =>
            loaded || isFocused ? (
              <Pane key={descriptor.route.key} visible={isFocused}>
                {descriptor.render()}
              </Pane>
            ) : null
          }
        />
      </BlurTargetView>

      <FloatingTabBar blurTarget={blurTarget} tabs={['index', 'groups', 'pet', 'profile']}>
        <TabTrigger name="index" asChild>
          <TabButton name="index" icon="walk" activeIcon="walk" label="Today" />
        </TabTrigger>
        <TabTrigger name="groups" asChild>
          <TabButton name="groups" icon="account-group-outline" activeIcon="account-group" label="Groups" />
        </TabTrigger>
        <TabTrigger name="pet" asChild>
          <TabButton name="pet" icon="paw-outline" activeIcon="paw" label="Pet" />
        </TabTrigger>
        <TabTrigger name="profile" asChild>
          <TabButton name="profile" icon="account-circle-outline" activeIcon="account-circle" label="Profile" />
        </TabTrigger>
      </FloatingTabBar>

      <TabList style={styles.hidden}>
        <TabTrigger name="index" href="/" />
        <TabTrigger name="groups" href="/groups" />
        <TabTrigger name="pet" href="/pet" />
        <TabTrigger name="profile" href="/profile" />
      </TabList>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hidden: { display: 'none' },
});
