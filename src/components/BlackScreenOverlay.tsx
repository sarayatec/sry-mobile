import { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableWithoutFeedback,
  StyleSheet,
  Platform,
  Animated,
} from 'react-native';
import { keepScreenOn } from '../../modules/camera-service';

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

export default function BlackScreenOverlay({ visible, onDismiss }: Props) {
  const hintOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) return;
    // Keep screen on when overlay is active
    if (Platform.OS === 'android') keepScreenOn(true);

    // Fade out the hint text after 3 seconds so it's less distracting
    const anim = Animated.sequence([
      Animated.delay(2500),
      Animated.timing(hintOpacity, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]);
    anim.start();

    return () => {
      anim.stop();
      hintOpacity.setValue(1);
      if (Platform.OS === 'android') keepScreenOn(false);
    };
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <TouchableWithoutFeedback onPress={onDismiss}>
        <View style={styles.container}>
          <Animated.Text style={[styles.hint, { opacity: hintOpacity }]}>
            البث نشط — اضغط للعودة
          </Animated.Text>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hint: {
    color: '#333',
    fontSize: 14,
  },
});
