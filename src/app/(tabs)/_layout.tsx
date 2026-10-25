import { BlurTargetView } from 'expo-blur';
import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { FloatingTabBar, TabButton } from '@/components/floating-tab-bar';

export default function TabLayout() {
  // Android blurs only what's inside this target, so the screens live in it and the bar sits outside.
  const blurTarget = useRef<View>(null);

  return (
    <Tabs style={styles.flex}>
      <BlurTargetView ref={blurTarget} style={styles.flex}>
        <TabSlot />
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
